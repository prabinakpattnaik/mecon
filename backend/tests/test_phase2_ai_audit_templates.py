"""Iteration-3 / Phase-2 tests: AI insights, WBS CSV import, Workflow Templates, Audit Logs."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://enterprise-watch.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@mecon.in", "password": "Mecon@2026"}
PC = {"email": "pc@mecon.in", "password": "Demo@2026"}
CONTRACTOR = {"email": "contractor@lnt.com", "password": "Demo@2026"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("access_token")
    assert tok, f"no access_token in {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin_client():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def pc_client():
    return _login(PC)


@pytest.fixture(scope="module")
def contractor_client():
    return _login(CONTRACTOR)


@pytest.fixture(scope="module")
def project_id(admin_client):
    # use existing first project, or create one
    r = admin_client.get(f"{API}/projects")
    assert r.status_code == 200
    projects = r.json()
    if projects:
        return projects[0]["id"]
    # create
    r = admin_client.post(f"{API}/projects", json={
        "code": "TEST-PH2",
        "name": "Phase2 Test Project",
        "client": "TestClient",
        "value_cr": 100,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
    })
    assert r.status_code in (200, 201)
    return r.json()["id"]


# ------------------ AI Insights ------------------
class TestAIInsights:
    def test_ai_insights_structure(self, admin_client, project_id):
        r = admin_client.get(f"{API}/projects/{project_id}/ai-insights", timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("health_summary", "top_risks", "recommendations", "forecast"):
            assert k in data, f"missing key {k} in response: {list(data.keys())}"
        assert isinstance(data["health_summary"], str)
        assert isinstance(data["top_risks"], list)
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["forecast"], str)
        # validate item shape if non-empty
        for r_ in data["top_risks"]:
            assert "title" in r_ and "why" in r_ and "impact" in r_
        for r_ in data["recommendations"]:
            assert "action" in r_ and "owner" in r_ and "priority" in r_

    def test_ai_insights_cached_second_call(self, admin_client, project_id):
        # first call (may be cached already)
        r1 = admin_client.get(f"{API}/projects/{project_id}/ai-insights", timeout=120)
        assert r1.status_code == 200
        ts1 = r1.json().get("created_at")
        t0 = time.time()
        r2 = admin_client.get(f"{API}/projects/{project_id}/ai-insights", timeout=30)
        elapsed = time.time() - t0
        assert r2.status_code == 200
        assert r2.json().get("created_at") == ts1, "Second call within 30 min should be cached (same created_at)"
        assert elapsed < 10, f"cached call took {elapsed:.2f}s, expected <10s"

    def test_ai_insights_force_regenerates(self, admin_client, project_id):
        r1 = admin_client.get(f"{API}/projects/{project_id}/ai-insights")
        ts1 = r1.json().get("created_at")
        r2 = admin_client.get(f"{API}/projects/{project_id}/ai-insights?force=true", timeout=120)
        assert r2.status_code == 200
        ts2 = r2.json().get("created_at")
        assert ts2 != ts1, "force=true should produce a new created_at"

    def test_ai_insights_404_invalid_project(self, admin_client):
        r = admin_client.get(f"{API}/projects/does-not-exist/ai-insights")
        assert r.status_code == 404


# ------------------ WBS CSV Import ------------------
class TestWbsImport:
    def test_csv_import_admin(self, admin_client, project_id):
        csv = (
            "code,parent_code,name,weightage,planned_start,planned_end\n"
            "TESTP2-R,,TEST Phase2 Root,100,2026-01-01,2026-12-31\n"
            "TESTP2-A,TESTP2-R,TEST Block A,50,2026-01-01,2026-06-30\n"
            "TESTP2-A1,TESTP2-A,TEST A.1 sub,30,2026-01-01,2026-03-31\n"
            "TESTP2-B,TESTP2-R,TEST Block B,50,2026-07-01,2026-12-31\n"
        )
        files = {"file": ("wbs.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = admin_client.post(f"{API}/wbs/import?project_id={project_id}", files=files)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") == True
        assert body.get("imported") == 4

        # Verify level auto-computation by fetching wbs tree
        rt = admin_client.get(f"{API}/wbs?project_id={project_id}")
        assert rt.status_code == 200
        items = rt.json()
        by_code = {i["code"]: i for i in items if i["code"].startswith("TESTP2")}
        assert by_code["TESTP2-R"]["level"] == 1
        assert by_code["TESTP2-A"]["level"] == 2
        assert by_code["TESTP2-A1"]["level"] == 3
        assert by_code["TESTP2-B"]["level"] == 2
        # parent_id linkage
        assert by_code["TESTP2-A"]["parent_id"] == by_code["TESTP2-R"]["id"]
        assert by_code["TESTP2-A1"]["parent_id"] == by_code["TESTP2-A"]["id"]

        # Cleanup: cascade-delete TESTP2-R
        root_id = by_code["TESTP2-R"]["id"]
        rd = admin_client.delete(f"{API}/wbs/{root_id}")
        assert rd.status_code == 200
        assert rd.json().get("deleted") == 4

    def test_csv_import_forbidden_for_contractor(self, contractor_client, project_id):
        csv = "code,name\nX,Y\n"
        files = {"file": ("w.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = contractor_client.post(f"{API}/wbs/import?project_id={project_id}", files=files)
        assert r.status_code == 403

    def test_csv_import_invalid_project(self, admin_client):
        csv = "code,name\nX,Y\n"
        files = {"file": ("w.csv", io.BytesIO(csv.encode()), "text/csv")}
        r = admin_client.post(f"{API}/wbs/import?project_id=nope", files=files)
        assert r.status_code == 404


# ------------------ WBS PATCH + cascade delete ------------------
class TestWbsCrudExtras:
    def test_wbs_patch_updates_fields(self, admin_client, project_id):
        # create temp node
        r = admin_client.post(f"{API}/wbs", json={
            "project_id": project_id, "code": "TESTUPD-1", "name": "Patch Me", "weightage": 10,
        })
        assert r.status_code == 200, r.text
        wid = r.json()["id"]
        p = admin_client.patch(f"{API}/wbs/{wid}", json={"name": "Patched", "progress": 42, "weightage": 25})
        assert p.status_code == 200
        # verify
        items = admin_client.get(f"{API}/wbs?project_id={project_id}").json()
        node = next(i for i in items if i["id"] == wid)
        assert node["name"] == "Patched"
        assert node["progress"] == 42
        assert node["weightage"] == 25
        # cleanup
        admin_client.delete(f"{API}/wbs/{wid}")


# ------------------ Workflow Templates ------------------
class TestWorkflowTemplates:
    @pytest.fixture(scope="class")
    def created_template(self, admin_client):
        payload = {
            "name": "TEST_Drawing_Template",
            "type": "drawing",
            "description": "Created from automated test",
            "default_priority": "High",
            "default_sla_hours": 24,
            "stages": ["Reviewer", "Section Incharge", "PC"],
        }
        r = admin_client.post(f"{API}/workflow-templates", json=payload)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == payload["name"]
        assert doc["stages"] == payload["stages"]
        assert doc["default_sla_hours"] == 24
        yield doc
        admin_client.delete(f"{API}/workflow-templates/{doc['id']}")

    def test_list_templates(self, admin_client, created_template):
        r = admin_client.get(f"{API}/workflow-templates")
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert created_template["id"] in ids

    def test_pc_can_create_template(self, pc_client):
        r = pc_client.post(f"{API}/workflow-templates", json={
            "name": "TEST_PC_Template", "type": "ncr", "stages": ["A", "B"],
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        pc_client.delete(f"{API}/workflow-templates/{tid}")

    def test_contractor_forbidden_template_create(self, contractor_client):
        r = contractor_client.post(f"{API}/workflow-templates", json={"name": "X", "type": "ncr"})
        assert r.status_code == 403

    def test_contractor_forbidden_template_delete(self, contractor_client, created_template):
        r = contractor_client.delete(f"{API}/workflow-templates/{created_template['id']}")
        assert r.status_code == 403

    def test_delete_template(self, admin_client):
        # create then delete
        r = admin_client.post(f"{API}/workflow-templates", json={"name": "TEST_DEL", "type": "ncr"})
        tid = r.json()["id"]
        rd = admin_client.delete(f"{API}/workflow-templates/{tid}")
        assert rd.status_code == 200
        # delete-non-existent -> 404
        rd2 = admin_client.delete(f"{API}/workflow-templates/{tid}")
        assert rd2.status_code == 404


# ------------------ Audit Logs ------------------
class TestAuditLogs:
    def test_audit_log_listing(self, admin_client):
        r = admin_client.get(f"{API}/audit-logs?limit=50")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            entry = data[0]
            for k in ("id", "action", "entity_type", "entity_id", "description", "created_at", "user_name", "user_role"):
                assert k in entry, f"missing {k}"

    def test_audit_log_entity_filter(self, admin_client):
        r = admin_client.get(f"{API}/audit-logs?entity_type=workflow_template&limit=200")
        assert r.status_code == 200
        for e in r.json():
            assert e["entity_type"] == "workflow_template"

    def test_audit_created_on_template_create(self, admin_client):
        # create
        r = admin_client.post(f"{API}/workflow-templates", json={"name": "TEST_AUDIT", "type": "ncr"})
        tid = r.json()["id"]
        # poll for audit entry
        found = False
        for _ in range(5):
            ev = admin_client.get(f"{API}/audit-logs?entity_type=workflow_template&limit=20").json()
            if any(e.get("entity_id") == tid and e.get("action") == "template.create" for e in ev):
                found = True
                break
            time.sleep(0.5)
        admin_client.delete(f"{API}/workflow-templates/{tid}")
        assert found, "expected template.create audit entry"

    def test_audit_limit_capped_at_500(self, admin_client):
        r = admin_client.get(f"{API}/audit-logs?limit=9999")
        assert r.status_code == 200
        assert len(r.json()) <= 500
