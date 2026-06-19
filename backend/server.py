from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- Config ----------------
JWT_ALGORITHM = "HS256"
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="MECON Project Monitoring Platform")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mecon")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return str(uuid.uuid4())


# ---------------- Auth Helpers ----------------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles and user.get("role") != "admin":
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep


# ---------------- Pydantic Models ----------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    organization: Optional[str] = "MECON"


class ProjectCreate(BaseModel):
    code: str
    name: str
    client: str
    location: str
    start_date: str
    end_date: str
    value_cr: float
    manager: Optional[str] = ""
    description: Optional[str] = ""


class PackageCreate(BaseModel):
    project_id: str
    code: str
    name: str
    discipline: str
    contractor: str
    value_cr: float


class WorkflowCreate(BaseModel):
    project_id: str
    package_id: Optional[str] = None
    type: str  # drawing|dpr|bill|ncr|hindrance|generic
    reference_id: Optional[str] = None
    title: str
    priority: str = "Medium"
    sla_hours: int = 48
    assigned_to: Optional[str] = None


class WorkflowAction(BaseModel):
    action: str  # approve|reject|escalate|comment
    comment: Optional[str] = ""


class DPRCreate(BaseModel):
    project_id: str
    package_id: str
    date: str
    planned_pct: float
    actual_pct: float
    manpower: int
    equipment: int
    activities: str


class NCRCreate(BaseModel):
    project_id: str
    package_id: str
    description: str
    severity: str
    responsible: str
    target_closure: str


class HindranceCreate(BaseModel):
    project_id: str
    package_id: Optional[str] = None
    type: str
    severity: str
    description: str
    responsible: str
    target_closure: str


class DrawingCreate(BaseModel):
    project_id: str
    package_id: str
    drawing_number: str
    title: str
    discipline: str
    originator: str


class BillCreate(BaseModel):
    project_id: str
    package_id: str
    bill_number: str
    type: str  # RA|Final|Advance
    contractor: str
    value_lakh: float


class WBSCreate(BaseModel):
    project_id: str
    parent_id: Optional[str] = None
    code: str
    name: str
    weightage: float = 0.0
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None


class WBSUpdate(BaseModel):
    name: Optional[str] = None
    weightage: Optional[float] = None
    progress: Optional[float] = None
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    status: Optional[str] = None


# ---------------- Auth Routes ----------------
@api.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"user": user, "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api.post("/users")
async def create_user(payload: UserCreate, user: dict = Depends(require_role("admin"))):
    if await db.users.find_one({"email": payload.email.lower()}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "id": uid(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "organization": payload.organization or "MECON",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash")
    doc.pop("_id", None)
    return doc


# ---------------- Projects ----------------
@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    items = await db.projects.find({}, {"_id": 0}).to_list(500)
    return items


@api.post("/projects")
async def create_project(payload: ProjectCreate, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["planned_progress"] = 0
    doc["actual_progress"] = 0
    doc["baseline_progress"] = 0
    doc["health"] = "green"
    doc["status"] = "Active"
    doc["created_at"] = now_iso()
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "project.create", "project", doc["id"], f"Created project {doc['code']}: {doc['name']}")
    return doc


@api.get("/projects/{pid}")
async def get_project(pid: str, user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


@api.get("/projects/{pid}/overview")
async def project_overview(pid: str, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Not found")
    packages = await db.packages.find({"project_id": pid}, {"_id": 0}).to_list(200)
    milestones = await db.milestones.find({"project_id": pid}, {"_id": 0}).to_list(200)
    open_ncrs = await db.ncrs.count_documents({"project_id": pid, "status": {"$ne": "Closed"}})
    open_hindrances = await db.hindrances.count_documents({"project_id": pid, "status": {"$ne": "Closed"}})
    pending_bills = await db.bills.count_documents({"project_id": pid, "status": {"$nin": ["Paid", "Rejected"]}})
    pending_drawings = await db.drawings.count_documents({"project_id": pid, "status": {"$nin": ["Approved", "Released"]}})
    # progress curve
    curve = await db.progress_curve.find({"project_id": pid}, {"_id": 0}).sort("week", 1).to_list(60)
    return {
        "project": project,
        "packages": packages,
        "milestones": milestones,
        "kpis": {
            "open_ncrs": open_ncrs,
            "open_hindrances": open_hindrances,
            "pending_bills": pending_bills,
            "pending_drawings": pending_drawings,
        },
        "curve": curve,
    }


# ---------------- Packages ----------------
@api.get("/packages")
async def list_packages(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"project_id": project_id} if project_id else {}
    return await db.packages.find(q, {"_id": 0}).to_list(500)


@api.post("/packages")
async def create_package(payload: PackageCreate, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["progress"] = 0
    doc["status"] = "Active"
    doc["created_at"] = now_iso()
    await db.packages.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Drawings ----------------
@api.get("/drawings")
async def list_drawings(project_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if status:
        q["status"] = status
    return await db.drawings.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(500)


@api.post("/drawings")
async def create_drawing(payload: DrawingCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["revision"] = "R0"
    doc["status"] = "Submitted"
    doc["submitted_at"] = now_iso()
    doc["approved_at"] = None
    await db.drawings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/drawings/{did}/approve")
async def approve_drawing(did: str, user: dict = Depends(require_role("ProjectCoordinator", "Reviewer", "admin"))):
    await db.drawings.update_one({"id": did}, {"$set": {"status": "Approved", "approved_at": now_iso()}})
    return {"ok": True}


@api.post("/drawings/{did}/reject")
async def reject_drawing(did: str, user: dict = Depends(require_role("ProjectCoordinator", "Reviewer", "admin"))):
    await db.drawings.update_one({"id": did}, {"$set": {"status": "Rejected"}})
    return {"ok": True}


# ---------------- DPR ----------------
@api.get("/dpr")
async def list_dpr(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"project_id": project_id} if project_id else {}
    return await db.dpr.find(q, {"_id": 0}).sort("date", -1).to_list(500)


@api.post("/dpr")
async def create_dpr(payload: DPRCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["variance"] = round(doc["actual_pct"] - doc["planned_pct"], 2)
    doc["status"] = "Submitted"
    doc["submitted_by"] = user["name"]
    doc["submitted_at"] = now_iso()
    await db.dpr.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/dpr/{did}/verify")
async def verify_dpr(did: str, user: dict = Depends(require_role("SiteEngineer", "ProjectCoordinator", "admin"))):
    await db.dpr.update_one({"id": did}, {"$set": {"status": "Verified", "verified_by": user["name"]}})
    return {"ok": True}


# ---------------- NCRs ----------------
@api.get("/ncrs")
async def list_ncrs(project_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if status:
        q["status"] = status
    return await db.ncrs.find(q, {"_id": 0}).sort("raised_at", -1).to_list(500)


@api.post("/ncrs")
async def create_ncr(payload: NCRCreate, user: dict = Depends(get_current_user)):
    count = await db.ncrs.count_documents({})
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["ncr_number"] = f"NCR-{2026}-{count + 1:04d}"
    doc["status"] = "Open"
    doc["raised_by"] = user["name"]
    doc["raised_at"] = now_iso()
    doc["closed_at"] = None
    await db.ncrs.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "ncr.create", "ncr", doc["id"], f"Raised {doc['ncr_number']}: {doc['description'][:60]}")
    return doc


@api.post("/ncrs/{nid}/close")
async def close_ncr(nid: str, user: dict = Depends(require_role("QAQCEngineer", "ProjectCoordinator", "admin"))):
    await db.ncrs.update_one({"id": nid}, {"$set": {"status": "Closed", "closed_at": now_iso()}})
    await log_audit(user, "ncr.close", "ncr", nid, "Closed NCR")
    return {"ok": True}


# ---------------- Hindrances ----------------
@api.get("/hindrances")
async def list_hindrances(project_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if status:
        q["status"] = status
    return await db.hindrances.find(q, {"_id": 0}).sort("raised_at", -1).to_list(500)


@api.post("/hindrances")
async def create_hindrance(payload: HindranceCreate, user: dict = Depends(get_current_user)):
    count = await db.hindrances.count_documents({})
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["hindrance_number"] = f"HND-{2026}-{count + 1:04d}"
    doc["status"] = "Open"
    doc["raised_by"] = user["name"]
    doc["raised_at"] = now_iso()
    doc["resolved_at"] = None
    await db.hindrances.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "hindrance.create", "hindrance", doc["id"], f"Registered {doc['hindrance_number']}: {doc['type']}")
    return doc


@api.post("/hindrances/{hid}/close")
async def close_hindrance(hid: str, user: dict = Depends(require_role("ProjectCoordinator", "SiteEngineer", "admin"))):
    await db.hindrances.update_one({"id": hid}, {"$set": {"status": "Closed", "resolved_at": now_iso()}})
    await log_audit(user, "hindrance.close", "hindrance", hid, "Resolved hindrance")
    return {"ok": True}


# ---------------- Bills ----------------
@api.get("/bills")
async def list_bills(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"project_id": project_id} if project_id else {}
    return await db.bills.find(q, {"_id": 0}).sort("submission_date", -1).to_list(500)


@api.post("/bills")
async def create_bill(payload: BillCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["submission_date"] = now_iso()
    doc["current_stage"] = "Submitted"
    doc["status"] = "Under Review"
    doc["payment_status"] = "Pending"
    doc["withheld_lakh"] = 0
    doc["aging_days"] = 0
    await db.bills.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/bills/{bid}/advance")
async def advance_bill(bid: str, user: dict = Depends(get_current_user)):
    stages = ["Submitted", "Measurement", "Site Verification", "Coordinator Review", "Finance Review", "SAP Processing", "Paid"]
    b = await db.bills.find_one({"id": bid})
    if not b:
        raise HTTPException(404, "Not found")
    idx = stages.index(b.get("current_stage", "Submitted"))
    next_stage = stages[min(idx + 1, len(stages) - 1)]
    update = {"current_stage": next_stage}
    if next_stage == "Paid":
        update["status"] = "Paid"
        update["payment_status"] = "Released"
    await db.bills.update_one({"id": bid}, {"$set": update})
    return {"ok": True, "stage": next_stage}


# ---------------- Workflows ----------------
@api.get("/workflows")
async def list_workflows(project_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id:
        q["project_id"] = project_id
    if status:
        q["status"] = status
    return await db.workflows.find(q, {"_id": 0}).sort("raised_at", -1).to_list(500)


@api.post("/workflows")
async def create_workflow(payload: WorkflowCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = uid()
    doc["status"] = "Pending"
    doc["current_stage"] = "Reviewer"
    doc["raised_by"] = user["name"]
    doc["raised_at"] = now_iso()
    doc["history"] = []
    await db.workflows.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/workflows/{wid}")
async def get_workflow(wid: str, user: dict = Depends(get_current_user)):
    w = await db.workflows.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Not found")
    return w


@api.post("/workflows/{wid}/action")
async def workflow_action(wid: str, payload: WorkflowAction, user: dict = Depends(get_current_user)):
    w = await db.workflows.find_one({"id": wid})
    if not w:
        raise HTTPException(404, "Not found")
    entry = {"by": user["name"], "role": user["role"], "action": payload.action, "comment": payload.comment, "at": now_iso()}
    history = w.get("history", []) + [entry]
    update = {"history": history}
    stages = ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator", "Closed"]
    cur = w.get("current_stage", "Reviewer")
    if payload.action == "approve":
        idx = stages.index(cur) if cur in stages else 0
        nxt = stages[min(idx + 1, len(stages) - 1)]
        update["current_stage"] = nxt
        update["status"] = "Approved" if nxt == "Closed" else "In Progress"
    elif payload.action == "reject":
        update["status"] = "Rejected"
    elif payload.action == "escalate":
        update["status"] = "Escalated"
    await db.workflows.update_one({"id": wid}, {"$set": update})
    await log_audit(user, f"workflow.{payload.action}", "workflow", wid, f"{payload.action.title()} – {w.get('title', '')[:60]}")
    return {"ok": True}


# ---------------- Notifications ----------------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"$or": [{"user_id": user["id"]}, {"user_id": "all"}]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return items


@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- My Actions ----------------
@api.get("/my-actions")
async def my_actions(user: dict = Depends(get_current_user)):
    actions = []
    # Pending workflows assigned (approximate: pending overall)
    wfs = await db.workflows.find({"status": {"$in": ["Pending", "In Progress", "Escalated"]}}, {"_id": 0}).sort("raised_at", -1).limit(15).to_list(15)
    for w in wfs:
        actions.append({"type": "Workflow", "title": w.get("title"), "project_id": w.get("project_id"), "priority": w.get("priority", "Medium"), "due": w.get("raised_at"), "id": w["id"], "ref": "workflows"})
    # Drawings pending
    dws = await db.drawings.find({"status": "Submitted"}, {"_id": 0}).sort("submitted_at", -1).limit(10).to_list(10)
    for d in dws:
        actions.append({"type": "Drawing Approval", "title": f"{d['drawing_number']} – {d['title']}", "project_id": d["project_id"], "priority": "Medium", "due": d["submitted_at"], "id": d["id"], "ref": "drawings"})
    # Open NCRs
    ncrs = await db.ncrs.find({"status": "Open"}, {"_id": 0}).sort("raised_at", -1).limit(10).to_list(10)
    for n in ncrs:
        actions.append({"type": "NCR", "title": f"{n['ncr_number']} – {n['description'][:50]}", "project_id": n["project_id"], "priority": n.get("severity", "Medium"), "due": n.get("target_closure"), "id": n["id"], "ref": "ncrs"})
    return actions


# ---------------- Dashboard ----------------
# ---------------- Dashboard helpers ----------------
async def _count_kpis() -> Dict[str, int]:
    return {
        "total_projects": await db.projects.count_documents({}),
        "active_projects": await db.projects.count_documents({"status": "Active"}),
        "delayed_projects": await db.projects.count_documents({"health": "red"}),
        "amber_projects": await db.projects.count_documents({"health": "amber"}),
        "open_ncrs": await db.ncrs.count_documents({"status": {"$ne": "Closed"}}),
        "open_hindrances": await db.hindrances.count_documents({"status": {"$ne": "Closed"}}),
        "pending_drawings": await db.drawings.count_documents({"status": "Submitted"}),
        "pending_workflows": await db.workflows.count_documents({"status": {"$in": ["Pending", "In Progress"]}}),
    }


async def _financial_snapshot() -> Dict[str, float]:
    bills = await db.bills.find({}, {"_id": 0}).to_list(1000)
    total = sum(b.get("value_lakh", 0) for b in bills)
    paid = sum(b.get("value_lakh", 0) for b in bills if b.get("status") == "Paid")
    return {
        "total_billed_lakh": round(total, 2),
        "paid_lakh": round(paid, 2),
        "outstanding_lakh": round(total - paid, 2),
    }


async def _portfolio_progress_rows() -> List[dict]:
    projects = await db.projects.find({}, {"_id": 0}).to_list(50)
    return [
        {"name": p["code"], "planned": p.get("planned_progress", 0), "actual": p.get("actual_progress", 0), "health": p.get("health", "green")}
        for p in projects
    ]


def _grade_for(avg: float) -> str:
    if avg >= 90: return "A+"
    if avg >= 75: return "A"
    if avg >= 60: return "B"
    if avg >= 45: return "C"
    return "D"


async def _contractor_performance_rows() -> List[dict]:
    contractors: Dict[str, dict] = {}
    for p in await db.packages.find({}, {"_id": 0}).to_list(500):
        c = p.get("contractor", "Unknown")
        agg = contractors.setdefault(c, {"contractor": c, "progress_sum": 0, "count": 0})
        agg["progress_sum"] += p.get("progress", 0)
        agg["count"] += 1
    rows = []
    for c, v in contractors.items():
        avg = round(v["progress_sum"] / max(v["count"], 1), 1)
        rows.append({"contractor": c, "avg_progress": avg, "grade": _grade_for(avg), "packages": v["count"]})
    rows.sort(key=lambda x: -x["avg_progress"])
    return rows


@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    kpis = await _count_kpis()
    kpis.update(await _financial_snapshot())
    return {
        "kpis": kpis,
        "portfolio_progress": await _portfolio_progress_rows(),
        "contractor_performance": await _contractor_performance_rows(),
    }


# ---------------- WBS ----------------
@api.get("/wbs")
async def list_wbs(project_id: str, user: dict = Depends(get_current_user)):
    items = await db.wbs.find({"project_id": project_id}, {"_id": 0}).sort("code", 1).to_list(2000)
    return items


@api.post("/wbs")
async def create_wbs(payload: WBSCreate, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    doc = payload.model_dump()
    doc["id"] = uid()
    # determine level
    level = 1
    if payload.parent_id:
        parent = await db.wbs.find_one({"id": payload.parent_id})
        if parent:
            level = (parent.get("level", 1) or 1) + 1
    if level > 10:
        raise HTTPException(400, "WBS hierarchy cannot exceed 10 levels")
    doc["level"] = level
    doc["progress"] = 0
    doc["actual_start"] = None
    doc["actual_end"] = None
    doc["status"] = "Not Started"
    doc["created_at"] = now_iso()
    await db.wbs.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "wbs.create", "wbs", doc["id"], f"Created WBS L{level}: {doc['code']} – {doc['name']}")
    return doc


@api.patch("/wbs/{wid}")
async def update_wbs(wid: str, payload: WBSUpdate, user: dict = Depends(require_role("admin", "ProjectCoordinator", "SiteEngineer"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    res = await db.wbs.update_one({"id": wid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    await log_audit(user, "wbs.update", "wbs", wid, f"Updated WBS fields: {', '.join(update.keys())}")
    return {"ok": True}


@api.delete("/wbs/{wid}")
async def delete_wbs(wid: str, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    # Recursive cascade delete
    to_delete = [wid]
    queue = [wid]
    while queue:
        next_queue = []
        for pid in queue:
            children = await db.wbs.find({"parent_id": pid}, {"_id": 0, "id": 1}).to_list(2000)
            for c in children:
                to_delete.append(c["id"])
                next_queue.append(c["id"])
        queue = next_queue
    await db.wbs.delete_many({"id": {"$in": to_delete}})
    await log_audit(user, "wbs.delete", "wbs", wid, f"Deleted WBS subtree ({len(to_delete)} nodes)")
    return {"ok": True, "deleted": len(to_delete)}


# ---------------- Gantt ----------------
@api.get("/projects/{pid}/gantt")
async def project_gantt(pid: str, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid})
    if not project:
        raise HTTPException(404, "Project not found")
    activities = await db.activities.find({"project_id": pid}, {"_id": 0}).sort("planned_start", 1).to_list(500)
    return activities


# ---------------- WBS Bulk Import (CSV) ----------------
def _parse_wbs_csv(content: str) -> List[dict]:
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        raise HTTPException(400, "Empty CSV file")
    required = {"code", "name"}
    headers = {(k or "").strip() for k in rows[0].keys()}
    if not required.issubset(headers):
        raise HTTPException(
            400,
            "CSV must include columns: code, name; optional: parent_code, weightage, planned_start, planned_end",
        )
    return rows


async def _insert_wbs_rows(project_id: str, rows: List[dict]) -> Dict[str, str]:
    code_to_id: Dict[str, str] = {}
    for r in rows:
        code = (r.get("code") or "").strip()
        if not code:
            continue
        wid = uid()
        code_to_id[code] = wid
        await db.wbs.insert_one({
            "id": wid,
            "project_id": project_id,
            "parent_id": None,
            "code": code,
            "name": (r.get("name") or "").strip(),
            "level": 1,
            "weightage": float(r.get("weightage") or 0),
            "planned_start": (r.get("planned_start") or "").strip() or None,
            "planned_end": (r.get("planned_end") or "").strip() or None,
            "actual_start": None,
            "actual_end": None,
            "progress": 0,
            "status": "Not Started",
            "created_at": now_iso(),
        })
    return code_to_id


async def _link_wbs_parents(rows: List[dict], code_to_id: Dict[str, str]) -> None:
    for r in rows:
        code = (r.get("code") or "").strip()
        parent_code = (r.get("parent_code") or "").strip()
        if not code or not parent_code:
            continue
        if parent_code == code:
            continue  # ignore self-reference defensively
        if parent_code in code_to_id and code in code_to_id:
            await db.wbs.update_one(
                {"id": code_to_id[code]},
                {"$set": {"parent_id": code_to_id[parent_code]}},
            )


async def _recompute_wbs_levels(project_id: str, ids: List[str]) -> None:
    nodes = await db.wbs.find(
        {"project_id": project_id, "id": {"$in": ids}}, {"_id": 0}
    ).to_list(5000)
    by_id = {n["id"]: n for n in nodes}
    levels: Dict[str, int] = {}

    def compute_level(nid: str, visiting: set) -> int:
        if nid in levels:
            return levels[nid]
        if nid in visiting:  # cycle guard
            levels[nid] = 1
            return 1
        node = by_id.get(nid)
        if not node or not node.get("parent_id") or node["parent_id"] not in by_id:
            levels[nid] = 1
        else:
            visiting.add(nid)
            levels[nid] = compute_level(node["parent_id"], visiting) + 1
            visiting.discard(nid)
        return levels[nid]

    for nid in by_id:
        lvl = min(10, compute_level(nid, set()))
        await db.wbs.update_one({"id": nid}, {"$set": {"level": lvl}})


@api.post("/wbs/import")
async def import_wbs_csv(
    project_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_role("admin", "ProjectCoordinator")),
):
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(404, "Project not found")
    content = (await file.read()).decode("utf-8", errors="ignore")
    rows = _parse_wbs_csv(content)
    code_to_id = await _insert_wbs_rows(project_id, rows)
    await _link_wbs_parents(rows, code_to_id)
    await _recompute_wbs_levels(project_id, list(code_to_id.values()))
    await log_audit(user, "wbs.import", "project", project_id, f"Imported {len(code_to_id)} WBS items via CSV")
    return {"ok": True, "imported": len(code_to_id)}


# ---------------- Workflow Templates ----------------
@api.get("/workflow-templates")
async def list_templates(user: dict = Depends(get_current_user)):
    items = await db.workflow_templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.post("/workflow-templates")
async def create_template(payload: dict, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    doc = {
        "id": uid(),
        "name": payload.get("name", "Untitled"),
        "type": payload.get("type", "drawing"),
        "description": payload.get("description", ""),
        "default_priority": payload.get("default_priority", "Medium"),
        "default_sla_hours": int(payload.get("default_sla_hours", 48)),
        "stages": payload.get("stages") or ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator"],
        "created_by": user["name"],
        "created_at": now_iso(),
    }
    await db.workflow_templates.insert_one(doc)
    await log_audit(user, "template.create", "workflow_template", doc["id"], f"Created template {doc['name']}")
    doc.pop("_id", None)
    return doc


@api.delete("/workflow-templates/{tid}")
async def delete_template(tid: str, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    res = await db.workflow_templates.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await log_audit(user, "template.delete", "workflow_template", tid, "Deleted workflow template")
    return {"ok": True}


# ---------------- Audit Logs ----------------
async def log_audit(user: dict, action: str, entity_type: str, entity_id: str, description: str, extra: dict = None):
    try:
        await db.audit_logs.insert_one({
            "id": uid(),
            "user_id": user.get("id"),
            "user_name": user.get("name"),
            "user_role": user.get("role"),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "description": description,
            "extra": extra or {},
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning(f"audit log failed: {e}")


@api.get("/audit-logs")
async def list_audit(
    user: dict = Depends(get_current_user),
    limit: int = 100,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_id: Optional[str] = None,
):
    q = {}
    if action:
        q["action"] = action
    if entity_type:
        q["entity_type"] = entity_type
    if user_id:
        q["user_id"] = user_id
    items = await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    return items


# ---------------- AI Risk Insights ----------------
AI_INSIGHT_CACHE_SECONDS = 1800
AI_SYSTEM_PROMPT = (
    "You are a senior PMC (project monitoring consultancy) analyst at MECON Limited. "
    "Given structured project data, return ONLY a JSON object with this exact shape: "
    '{"health_summary":"<one paragraph, 2-3 sentences>", '
    '"top_risks":[{"title":"...","why":"...","impact":"High|Medium|Low"}], '
    '"recommendations":[{"action":"...","owner":"...","priority":"P0|P1|P2"}], '
    '"forecast":"<one sentence delay/cost forecast>"}. '
    "Limit top_risks to 3 items and recommendations to 3 items. Do not include markdown fences, only raw JSON."
)


def _safe_iso_age_days(iso_str: Optional[str]) -> Optional[int]:
    if not iso_str:
        return None
    try:
        d = datetime.fromisoformat(iso_str)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - d).days
    except Exception:
        return None


async def _get_cached_ai_insight(pid: str) -> Optional[dict]:
    cached = await db.ai_insights.find_one({"project_id": pid}, {"_id": 0})
    if not cached:
        return None
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(cached["created_at"])).total_seconds()
    return cached if age < AI_INSIGHT_CACHE_SECONDS else None


async def _build_ai_context(pid: str, project: dict) -> dict:
    packages = await db.packages.find({"project_id": pid}, {"_id": 0}).to_list(50)
    ncrs_open = await db.ncrs.find({"project_id": pid, "status": "Open"}, {"_id": 0}).to_list(50)
    hinds_open = await db.hindrances.find({"project_id": pid, "status": "Open"}, {"_id": 0}).to_list(50)
    milestones = await db.milestones.find({"project_id": pid}, {"_id": 0}).to_list(50)
    recent_dpr = await db.dpr.find({"project_id": pid}, {"_id": 0}).sort("date", -1).limit(10).to_list(10)

    ncr_sev_counts: Dict[str, int] = {}
    for n in ncrs_open:
        sev = n.get("severity", "Medium")
        ncr_sev_counts[sev] = ncr_sev_counts.get(sev, 0) + 1

    hind_top = [
        {
            "type": h.get("type"),
            "severity": h.get("severity"),
            "desc": (h.get("description") or "")[:80],
            "age_days": _safe_iso_age_days(h.get("raised_at")),
        }
        for h in hinds_open[:5]
    ]
    delayed_ms = [m for m in milestones if m.get("status") == "Delayed"]
    variances = [d.get("variance", 0) for d in recent_dpr]
    avg_var = round(sum(variances) / max(1, len(variances)), 2)

    return {
        "project": {
            "code": project["code"], "name": project["name"], "client": project["client"],
            "planned_pct": project.get("planned_progress"), "actual_pct": project.get("actual_progress"),
            "health": project.get("health"), "start": project.get("start_date"), "end": project.get("end_date"),
            "value_cr": project.get("value_cr"),
        },
        "packages_count": len(packages),
        "packages_underperforming": [p["code"] for p in packages if p.get("progress", 0) < 40][:5],
        "open_ncrs_count": len(ncrs_open),
        "ncr_severity_counts": ncr_sev_counts,
        "open_hindrances_count": len(hinds_open),
        "top_hindrances": hind_top,
        "delayed_milestones": [{"name": m["name"], "planned": m["planned_date"]} for m in delayed_ms[:5]],
        "dpr_avg_variance_last_10": avg_var,
    }


def _parse_claude_response(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`").lstrip("json").strip()
    try:
        import json as _json
        return _json.loads(raw)
    except Exception:
        return {"health_summary": raw[:800], "top_risks": [], "recommendations": [], "forecast": ""}


async def _call_claude_insights(pid: str, context: dict) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    import json as _json
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"mecon-insights-{pid}",
        system_message=AI_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")
    prompt = f"Project data:\n{_json.dumps(context, indent=2)}\n\nReturn JSON only."
    buf: List[str] = []
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            buf.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    parsed = _parse_claude_response("".join(buf))
    parsed["is_fallback"] = False
    return parsed


def _rule_based_fallback(context: dict, err_name: str) -> dict:
    avg_var = context.get("dpr_avg_variance_last_10", 0)
    proj = context["project"]
    return {
        "health_summary": (
            f"AI engine unavailable ({err_name}). Rule-based summary: project at "
            f"{proj['actual_pct']}% actual vs {proj['planned_pct']}% planned with "
            f"{context['open_ncrs_count']} open NCRs."
        ),
        "top_risks": [
            {"title": "Schedule variance", "why": f"DPR avg variance {avg_var}", "impact": "High" if avg_var < -1 else "Medium"},
        ],
        "recommendations": [
            {"action": "Review critical-path activities with package coordinators", "owner": "Project Coordinator", "priority": "P0"},
        ],
        "forecast": "",
        "is_fallback": True,
    }


@api.get("/projects/{pid}/ai-insights")
async def project_ai_insights(pid: str, force: bool = False, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": pid}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")

    if not force:
        cached = await _get_cached_ai_insight(pid)
        if cached:
            return cached

    context = await _build_ai_context(pid, project)
    try:
        parsed = await _call_claude_insights(pid, context)
    except Exception as e:
        logger.exception(f"AI insights failed: {e}")
        parsed = _rule_based_fallback(context, type(e).__name__)

    insight_doc = {
        "id": uid(),
        "project_id": pid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": user.get("name"),
        "context_snapshot": context,
        **parsed,
    }
    await db.ai_insights.replace_one({"project_id": pid}, insight_doc, upsert=True)
    insight_doc.pop("_id", None)
    return insight_doc


# ---------------- Mount ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Seed ----------------
from seed import seed_admin_and_demo as _seed_orchestrator


async def seed_admin_and_demo():
    """Thin wrapper — delegates to seed.py for separation of concerns."""
    await _seed_orchestrator(db)


@app.on_event("startup")
async def on_startup():
    try:
        await seed_admin_and_demo()
    except Exception as e:
        logger.exception(f"Seed failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
