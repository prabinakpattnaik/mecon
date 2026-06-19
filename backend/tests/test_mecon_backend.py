"""MECON Project Monitoring System - Backend API Tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://enterprise-watch.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@mecon.in", "password": "Mecon@2026"}
DEMO_USERS = [
    ("pc@mecon.in", "Demo@2026", "ProjectCoordinator"),
    ("site@mecon.in", "Demo@2026", "SiteEngineer"),
    ("qaqc@mecon.in", "Demo@2026", "QAQCEngineer"),
    ("finance@mecon.in", "Demo@2026", "FinanceOfficer"),
    ("contractor@lnt.com", "Demo@2026", "Contractor"),
    ("client@sail.in", "Demo@2026", "Client"),
]


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def contractor_headers():
    r = requests.post(f"{API}/auth/login", json={"email": "contractor@lnt.com", "password": "Demo@2026"}, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------- Auth tests ----------
class TestAuth:
    def test_login_admin_success(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == "admin@mecon.in"
        assert data["user"]["role"] == "admin"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@mecon.in", "password": "WrongPass"}, timeout=15)
        assert r.status_code in (400, 401, 403)

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@mecon.in"

    @pytest.mark.parametrize("email,password,role", DEMO_USERS)
    def test_demo_user_login(self, email, password, role):
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
        assert r.status_code == 200, f"{email} login failed: {r.text}"
        u = r.json()["user"]
        assert u["email"] == email
        assert u["role"] == role


# ---------- Protected endpoints require auth ----------
class TestProtected:
    @pytest.mark.parametrize("path", [
        "/projects", "/dashboard/summary", "/users",
        "/drawings", "/dpr", "/ncrs", "/hindrances", "/bills",
        "/workflows", "/notifications", "/my-actions"
    ])
    def test_endpoint_requires_auth(self, path):
        r = requests.get(f"{API}{path}", timeout=15)
        assert r.status_code == 401, f"{path} did not return 401 (got {r.status_code})"


# ---------- Seed data verification ----------
class TestSeedData:
    def test_projects_count_and_codes(self, admin_headers):
        r = requests.get(f"{API}/projects", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) >= 5, f"Expected >=5 projects, got {len(projects)}"
        codes = {p.get("code") for p in projects}
        expected = {"BSP-EXP-3", "RSP-COKE-7", "NMDC-IRON", "PWR-NTPC", "BHEL-MFG"}
        assert expected.issubset(codes), f"Missing codes: {expected - codes}"

    def test_packages_seeded(self, admin_headers):
        r = requests.get(f"{API}/packages", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_drawings_seeded(self, admin_headers):
        r = requests.get(f"{API}/drawings", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 30

    def test_dpr_seeded(self, admin_headers):
        r = requests.get(f"{API}/dpr", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 50

    def test_ncrs_seeded(self, admin_headers):
        r = requests.get(f"{API}/ncrs", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_hindrances_seeded(self, admin_headers):
        r = requests.get(f"{API}/hindrances", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_bills_seeded(self, admin_headers):
        r = requests.get(f"{API}/bills", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 15

    def test_workflows_seeded(self, admin_headers):
        r = requests.get(f"{API}/workflows", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 20

    def test_notifications_seeded(self, admin_headers):
        r = requests.get(f"{API}/notifications", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 5


# ---------- Dashboard summary ----------
class TestDashboard:
    def test_dashboard_summary(self, admin_headers):
        r = requests.get(f"{API}/dashboard/summary", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Verify some expected KPI fields exist (loose check)
        keys_str = str(data).lower()
        for kw in ["project", "ncr", "hindrance", "drawing"]:
            assert kw in keys_str, f"Dashboard missing key containing '{kw}'"

    def test_my_actions(self, admin_headers):
        r = requests.get(f"{API}/my-actions", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))


# ---------- Project Detail & Overview ----------
class TestProjectDetail:
    def test_project_overview(self, admin_headers):
        projects = requests.get(f"{API}/projects", headers=admin_headers, timeout=15).json()
        pid = projects[0]["id"]
        r = requests.get(f"{API}/projects/{pid}/overview", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Should contain project info + relations
        assert isinstance(data, dict)


# ---------- Workflow actions ----------
class TestWorkflowActions:
    def test_workflow_approve(self, admin_headers):
        wfs = requests.get(f"{API}/workflows", headers=admin_headers, timeout=15).json()
        pending = [w for w in wfs if w.get("status") in ("Pending", "InProgress", "In Progress")]
        if not pending:
            pytest.skip("No pending workflows to approve")
        wid = pending[0]["id"]
        r = requests.post(f"{API}/workflows/{wid}/action",
                          json={"action": "approve", "remarks": "TEST_approval"},
                          headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"Workflow approve failed: {r.status_code} {r.text}"


# ---------- Drawing approve ----------
class TestDrawingActions:
    def test_drawing_approve(self, admin_headers):
        dws = requests.get(f"{API}/drawings", headers=admin_headers, timeout=15).json()
        submitted = [d for d in dws if d.get("status") in ("Submitted", "Pending")]
        if not submitted:
            pytest.skip("No submitted drawings")
        did = submitted[0]["id"]
        r = requests.post(f"{API}/drawings/{did}/approve", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201)


# ---------- NCR close ----------
class TestNCRActions:
    def test_ncr_close(self, admin_headers):
        ncrs = requests.get(f"{API}/ncrs", headers=admin_headers, timeout=15).json()
        open_ncrs = [n for n in ncrs if n.get("status") in ("Open", "InProgress")]
        if not open_ncrs:
            pytest.skip("No open NCRs")
        nid = open_ncrs[0]["id"]
        r = requests.post(f"{API}/ncrs/{nid}/close", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201)


# ---------- Hindrance close ----------
class TestHindranceActions:
    def test_hindrance_close(self, admin_headers):
        hs = requests.get(f"{API}/hindrances", headers=admin_headers, timeout=15).json()
        open_h = [h for h in hs if h.get("status") in ("Open", "InProgress")]
        if not open_h:
            pytest.skip("No open hindrances")
        hid = open_h[0]["id"]
        r = requests.post(f"{API}/hindrances/{hid}/close", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201)


# ---------- Bill advance ----------
class TestBillActions:
    def test_bill_advance(self, admin_headers):
        bills = requests.get(f"{API}/bills", headers=admin_headers, timeout=15).json()
        non_paid = [b for b in bills if b.get("stage") != "Paid" and b.get("status") != "Paid"]
        if not non_paid:
            pytest.skip("No non-paid bills")
        bid = non_paid[0]["id"]
        r = requests.post(f"{API}/bills/{bid}/advance", headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"Bill advance failed: {r.status_code} {r.text}"


# ---------- RBAC ----------
class TestRBAC:
    def test_contractor_cannot_create_project(self, contractor_headers):
        r = requests.post(f"{API}/projects",
                          json={"code": "TEST_RBAC", "name": "TEST", "client": "TEST",
                                "contractor": "TEST", "value_cr": 1.0, "planned_pct": 0, "actual_pct": 0},
                          headers=contractor_headers, timeout=15)
        assert r.status_code == 403, f"Contractor should not create project, got {r.status_code}"

    def test_contractor_cannot_create_user(self, contractor_headers):
        r = requests.post(f"{API}/users",
                          json={"email": "TEST_evil@x.com", "password": "Test@2026",
                                "name": "Evil", "role": "admin"},
                          headers=contractor_headers, timeout=15)
        assert r.status_code == 403


# ---------- Create→GET persistence ----------
class TestCRUDPersistence:
    def test_create_project_admin(self, admin_headers):
        payload = {
            "code": "TEST_PRJ_X1",
            "name": "TEST Project X1",
            "client": "TEST Client",
            "contractor": "TEST Contractor",
            "value_cr": 25.5,
            "planned_pct": 10,
            "actual_pct": 5,
            "location": "TEST Site",
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        }
        r = requests.post(f"{API}/projects", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), f"Create project: {r.status_code} {r.text}"
        created = r.json()
        assert created["code"] == payload["code"]
        pid = created["id"]
        # GET to verify
        g = requests.get(f"{API}/projects/{pid}", headers=admin_headers, timeout=15)
        assert g.status_code == 200
        assert g.json()["code"] == payload["code"]
