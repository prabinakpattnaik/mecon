"""Tests for WBS, Gantt, Workflow detail endpoints (Iteration 2)"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://enterprise-watch.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@mecon.in", "password": "Mecon@2026"}
CONTRACTOR = {"email": "contractor@lnt.com", "password": "Demo@2026"}


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def contractor_headers():
    r = requests.post(f"{API}/auth/login", json=CONTRACTOR, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def first_project(admin_headers):
    r = requests.get(f"{API}/projects", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    return r.json()[0]


# ----------------- WBS GET -----------------
class TestWBSList:
    def test_wbs_requires_auth(self, first_project):
        r = requests.get(f"{API}/wbs", params={"project_id": first_project["id"]}, timeout=15)
        assert r.status_code == 401

    def test_wbs_list_for_project(self, admin_headers, first_project):
        r = requests.get(f"{API}/wbs", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # Expect rich hierarchy
        assert len(items) >= 30, f"WBS expected ≥30 items, got {len(items)}"
        # Required fields
        sample = items[0]
        for k in ["id", "project_id", "code", "name", "level", "progress", "weightage", "planned_start", "planned_end"]:
            assert k in sample, f"Missing key {k} in WBS item"
        # parent_id may be None for root
        assert "parent_id" in sample
        # Levels 1..4 present
        levels = {i["level"] for i in items}
        assert {1, 2, 3, 4}.issubset(levels), f"Missing levels: {levels}"


# ----------------- WBS RBAC + CRUD -----------------
class TestWBSCRUD:
    def test_contractor_cannot_create_wbs(self, contractor_headers, first_project):
        payload = {
            "project_id": first_project["id"],
            "parent_id": None,
            "code": "TEST.RBAC",
            "name": "TEST RBAC WBS",
            "weightage": 5.0,
        }
        r = requests.post(f"{API}/wbs", json=payload, headers=contractor_headers, timeout=15)
        assert r.status_code == 403, f"Contractor should be 403, got {r.status_code}"

    def test_admin_create_wbs_root_and_child(self, admin_headers, first_project):
        # Create root (level 1, since no parent)
        root_payload = {
            "project_id": first_project["id"],
            "parent_id": None,
            "code": "TEST_WBS_ROOT",
            "name": "TEST WBS Root",
            "weightage": 10.0,
            "planned_start": "2026-01-01",
            "planned_end": "2026-12-31",
        }
        r = requests.post(f"{API}/wbs", json=root_payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        root = r.json()
        assert root["level"] == 1
        assert root["code"] == "TEST_WBS_ROOT"
        assert root["progress"] == 0
        root_id = root["id"]

        # Create child (should auto-level to 2)
        child_payload = {
            "project_id": first_project["id"],
            "parent_id": root_id,
            "code": "TEST_WBS_ROOT.1",
            "name": "TEST WBS Child",
            "weightage": 5.0,
        }
        r2 = requests.post(f"{API}/wbs", json=child_payload, headers=admin_headers, timeout=15)
        assert r2.status_code in (200, 201)
        child = r2.json()
        assert child["level"] == 2
        child_id = child["id"]

        # PATCH update
        patch_payload = {"name": "TEST WBS Root Updated", "progress": 35.5}
        rp = requests.patch(f"{API}/wbs/{root_id}", json=patch_payload, headers=admin_headers, timeout=15)
        assert rp.status_code == 200, f"PATCH failed: {rp.status_code} {rp.text}"

        # Verify via GET list
        rl = requests.get(f"{API}/wbs", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15)
        items = {i["id"]: i for i in rl.json()}
        assert items[root_id]["name"] == "TEST WBS Root Updated"
        assert items[root_id]["progress"] == 35.5

        # DELETE root → cascades to child
        rd = requests.delete(f"{API}/wbs/{root_id}", headers=admin_headers, timeout=15)
        assert rd.status_code == 200
        rl2 = requests.get(f"{API}/wbs", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15)
        ids = {i["id"] for i in rl2.json()}
        assert root_id not in ids, "Root WBS not deleted"
        assert child_id not in ids, "Child WBS not cascade-deleted"

    def test_patch_nonexistent_wbs_returns_404(self, admin_headers):
        r = requests.patch(f"{API}/wbs/nonexistent-id", json={"name": "x"}, headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ----------------- Gantt -----------------
class TestGantt:
    def test_gantt_requires_auth(self, first_project):
        r = requests.get(f"{API}/projects/{first_project['id']}/gantt", timeout=15)
        assert r.status_code == 401

    def test_gantt_returns_activities(self, admin_headers, first_project):
        r = requests.get(f"{API}/projects/{first_project['id']}/gantt", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        acts = r.json()
        assert isinstance(acts, list)
        assert len(acts) >= 10, f"Gantt expected ≥10 activities, got {len(acts)}"
        sample = acts[0]
        for k in ["id", "project_id", "name", "planned_start", "planned_end", "progress", "area", "is_critical"]:
            assert k in sample, f"Gantt missing {k}"
        areas = {a["area"] for a in acts}
        assert {"Engineering", "Procurement", "Construction"}.issubset(areas), f"Missing areas: {areas}"


# ----------------- Workflow detail -----------------
class TestWorkflowDetail:
    def test_workflow_detail_history(self, admin_headers):
        wfs = requests.get(f"{API}/workflows", headers=admin_headers, timeout=15).json()
        assert len(wfs) > 0
        wid = wfs[0]["id"]
        r = requests.get(f"{API}/workflows/{wid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        w = r.json()
        for k in ["id", "title", "priority", "sla_hours", "current_stage", "status", "history"]:
            assert k in w, f"Workflow missing {k}"
        assert isinstance(w["history"], list)

    def test_workflow_action_appends_history(self, admin_headers):
        wfs = requests.get(f"{API}/workflows", headers=admin_headers, timeout=15).json()
        pending = [w for w in wfs if w.get("status") in ("Pending", "In Progress")]
        if not pending:
            pytest.skip("No pending workflow")
        wid = pending[0]["id"]
        before = requests.get(f"{API}/workflows/{wid}", headers=admin_headers, timeout=15).json()
        before_n = len(before.get("history", []))
        # Approve with comment
        ra = requests.post(f"{API}/workflows/{wid}/action",
                           json={"action": "approve", "comment": "TEST_iteration2 approval"},
                           headers=admin_headers, timeout=15)
        assert ra.status_code == 200
        after = requests.get(f"{API}/workflows/{wid}", headers=admin_headers, timeout=15).json()
        assert len(after["history"]) == before_n + 1
        last = after["history"][-1]
        assert last["action"] == "approve"
        assert last["comment"] == "TEST_iteration2 approval"

    def test_workflow_detail_404(self, admin_headers):
        r = requests.get(f"{API}/workflows/nonexistent-wf-id", headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ----------------- Existing create endpoints still work -----------------
class TestExistingCreateEndpoints:
    def test_create_ncr(self, admin_headers, first_project):
        pkgs = requests.get(f"{API}/packages", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15).json()
        assert len(pkgs) > 0
        payload = {
            "project_id": first_project["id"],
            "package_id": pkgs[0]["id"],
            "description": "TEST_iter2 NCR description",
            "severity": "Medium",
            "responsible": "TEST_resp",
            "target_closure": "2026-12-31",
        }
        r = requests.post(f"{API}/ncrs", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
        assert r.json()["description"] == payload["description"]

    def test_create_hindrance(self, admin_headers, first_project):
        pkgs = requests.get(f"{API}/packages", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15).json()
        payload = {
            "project_id": first_project["id"],
            "package_id": pkgs[0]["id"],
            "type": "Material Non-Availability",
            "severity": "High",
            "description": "TEST_iter2 hindrance",
            "responsible": "TEST_resp",
            "target_closure": "2026-12-31",
        }
        r = requests.post(f"{API}/hindrances", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201)
        assert r.json()["type"] == "Material Non-Availability"

    def test_create_dpr(self, admin_headers, first_project):
        pkgs = requests.get(f"{API}/packages", params={"project_id": first_project["id"]}, headers=admin_headers, timeout=15).json()
        payload = {
            "project_id": first_project["id"],
            "package_id": pkgs[0]["id"],
            "date": "2026-01-15",
            "planned_pct": 2.5,
            "actual_pct": 2.1,
            "manpower": 120,
            "equipment": 8,
            "activities": "TEST_iter2 dpr activities",
        }
        r = requests.post(f"{API}/dpr", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["activities"] == payload["activities"]
        assert data["variance"] == round(payload["actual_pct"] - payload["planned_pct"], 2)
