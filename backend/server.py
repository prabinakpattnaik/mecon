from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import random
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
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
    return doc


@api.post("/ncrs/{nid}/close")
async def close_ncr(nid: str, user: dict = Depends(require_role("QAQCEngineer", "ProjectCoordinator", "admin"))):
    await db.ncrs.update_one({"id": nid}, {"$set": {"status": "Closed", "closed_at": now_iso()}})
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
    return doc


@api.post("/hindrances/{hid}/close")
async def close_hindrance(hid: str, user: dict = Depends(require_role("ProjectCoordinator", "SiteEngineer", "admin"))):
    await db.hindrances.update_one({"id": hid}, {"$set": {"status": "Closed", "resolved_at": now_iso()}})
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
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "Active"})
    delayed = await db.projects.count_documents({"health": "red"})
    amber = await db.projects.count_documents({"health": "amber"})
    open_ncrs = await db.ncrs.count_documents({"status": {"$ne": "Closed"}})
    open_hindrances = await db.hindrances.count_documents({"status": {"$ne": "Closed"}})
    pending_drawings = await db.drawings.count_documents({"status": "Submitted"})
    pending_workflows = await db.workflows.count_documents({"status": {"$in": ["Pending", "In Progress"]}})

    # financial snapshot
    bills = await db.bills.find({}, {"_id": 0}).to_list(1000)
    total_billed = sum(b.get("value_lakh", 0) for b in bills)
    paid = sum(b.get("value_lakh", 0) for b in bills if b.get("status") == "Paid")
    outstanding = total_billed - paid

    projects = await db.projects.find({}, {"_id": 0}).to_list(50)
    portfolio_progress = [
        {"name": p["code"], "planned": p.get("planned_progress", 0), "actual": p.get("actual_progress", 0), "health": p.get("health", "green")}
        for p in projects
    ]

    # contractor performance
    contractors = {}
    for p in await db.packages.find({}, {"_id": 0}).to_list(500):
        c = p.get("contractor", "Unknown")
        contractors.setdefault(c, {"contractor": c, "progress_sum": 0, "count": 0})
        contractors[c]["progress_sum"] += p.get("progress", 0)
        contractors[c]["count"] += 1
    contractor_perf = []
    for c, v in contractors.items():
        avg = round(v["progress_sum"] / max(v["count"], 1), 1)
        grade = "A+" if avg >= 90 else "A" if avg >= 75 else "B" if avg >= 60 else "C" if avg >= 45 else "D"
        contractor_perf.append({"contractor": c, "avg_progress": avg, "grade": grade, "packages": v["count"]})
    contractor_perf.sort(key=lambda x: -x["avg_progress"])

    return {
        "kpis": {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "delayed_projects": delayed,
            "amber_projects": amber,
            "open_ncrs": open_ncrs,
            "open_hindrances": open_hindrances,
            "pending_drawings": pending_drawings,
            "pending_workflows": pending_workflows,
            "total_billed_lakh": round(total_billed, 2),
            "outstanding_lakh": round(outstanding, 2),
            "paid_lakh": round(paid, 2),
        },
        "portfolio_progress": portfolio_progress,
        "contractor_performance": contractor_perf,
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
    doc["level"] = level
    doc["progress"] = 0
    doc["actual_start"] = None
    doc["actual_end"] = None
    doc["status"] = "Not Started"
    doc["created_at"] = now_iso()
    await db.wbs.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/wbs/{wid}")
async def update_wbs(wid: str, payload: WBSUpdate, user: dict = Depends(require_role("admin", "ProjectCoordinator", "SiteEngineer"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    res = await db.wbs.update_one({"id": wid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/wbs/{wid}")
async def delete_wbs(wid: str, user: dict = Depends(require_role("admin", "ProjectCoordinator"))):
    # Cascade delete children
    children = await db.wbs.find({"parent_id": wid}, {"_id": 0, "id": 1}).to_list(2000)
    for c in children:
        await db.wbs.delete_many({"id": c["id"]})
    await db.wbs.delete_one({"id": wid})
    return {"ok": True}


# ---------------- Gantt ----------------
@api.get("/projects/{pid}/gantt")
async def project_gantt(pid: str, user: dict = Depends(get_current_user)):
    activities = await db.activities.find({"project_id": pid}, {"_id": 0}).sort("planned_start", 1).to_list(500)
    return activities


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
async def seed_admin_and_demo():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("id")
    await db.packages.create_index("project_id")

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": uid(),
            "email": admin_email,
            "password_hash": hash_password(admin_pw),
            "name": "MECON Administrator",
            "role": "admin",
            "organization": "MECON Limited",
            "created_at": now_iso(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    # Seed demo users
    demo_users = [
        ("pc@mecon.in", "Demo@2026", "Rajesh Kumar", "ProjectCoordinator", "MECON Limited"),
        ("site@mecon.in", "Demo@2026", "Anita Sharma", "SiteEngineer", "MECON Limited"),
        ("qaqc@mecon.in", "Demo@2026", "Vikram Singh", "QAQCEngineer", "MECON Limited"),
        ("finance@mecon.in", "Demo@2026", "Priya Patel", "FinanceOfficer", "MECON Limited"),
        ("contractor@lnt.com", "Demo@2026", "Suresh Iyer", "Contractor", "L&T Construction"),
        ("client@sail.in", "Demo@2026", "Amit Banerjee", "Client", "SAIL"),
    ]
    for em, pw, nm, rl, og in demo_users:
        if not await db.users.find_one({"email": em}):
            await db.users.insert_one({
                "id": uid(),
                "email": em,
                "password_hash": hash_password(pw),
                "name": nm,
                "role": rl,
                "organization": og,
                "created_at": now_iso(),
            })

    # If projects already exist, skip rest of seeding except WBS check
    if await db.projects.count_documents({}) > 0:
        # Seed WBS + activities if missing (so existing pods get this new data)
        if await db.wbs.count_documents({}) == 0:
            rnd = random.Random(42)
            existing_projects = await db.projects.find({}, {"_id": 0}).to_list(50)
            project_ids = [(p["id"], p["code"], p["name"]) for p in existing_projects]
            await _seed_wbs_and_activities(project_ids, rnd)
        return

    rnd = random.Random(42)

    project_defs = [
        ("BSP-EXP-3", "Bhilai Steel Plant Expansion Phase-3", "SAIL", "Bhilai, Chhattisgarh", "2024-04-01", "2027-03-31", 8540.0, 62, 58, "amber"),
        ("RSP-COKE-7", "Rourkela Coke Oven Battery #7", "SAIL", "Rourkela, Odisha", "2025-01-15", "2027-12-31", 3200.0, 41, 44, "green"),
        ("NMDC-IRON", "NMDC Iron Ore Beneficiation Plant", "NMDC Limited", "Bacheli, Chhattisgarh", "2024-08-10", "2027-06-30", 5680.0, 55, 49, "amber"),
        ("PWR-NTPC", "NTPC Talcher Super Thermal Stg-3", "NTPC", "Talcher, Odisha", "2024-02-01", "2028-01-31", 12340.0, 38, 34, "red"),
        ("BHEL-MFG", "BHEL Bhopal Heavy Equipment Mfg Bay", "BHEL", "Bhopal, MP", "2025-05-01", "2027-04-30", 1850.0, 22, 26, "green"),
    ]
    project_ids = []
    for code, name, cli, loc, sd, ed, val, pp, ap, health in project_defs:
        pid = uid()
        project_ids.append((pid, code, name))
        await db.projects.insert_one({
            "id": pid, "code": code, "name": name, "client": cli, "location": loc,
            "start_date": sd, "end_date": ed, "value_cr": val, "manager": "MECON PMG",
            "description": f"Turnkey EPC monitoring for {name}",
            "planned_progress": pp, "actual_progress": ap, "baseline_progress": pp - 2,
            "health": health, "status": "Active", "created_at": now_iso(),
        })
        # progress curve – 24 weeks
        for w in range(1, 25):
            planned = round(min(100, (pp / 24) * w + rnd.uniform(-1, 1)), 1)
            actual = round(min(100, planned + rnd.uniform(-6, 3)), 1)
            await db.progress_curve.insert_one({
                "id": uid(), "project_id": pid, "week": w,
                "planned": planned, "actual": actual,
            })

    # Packages
    disciplines = ["Civil", "Structural", "Mechanical", "Electrical", "Instrumentation", "Piping"]
    contractors = ["L&T Construction", "Tata Projects", "Afcons Infrastructure", "Punj Lloyd", "ISGEC", "BHEL"]
    package_ids = []
    for pid, pcode, _ in project_ids:
        for i, disc in enumerate(disciplines):
            pkg_id = uid()
            ctr = contractors[(hash(pcode) + i) % len(contractors)]
            await db.packages.insert_one({
                "id": pkg_id,
                "project_id": pid,
                "code": f"{pcode}-{disc[:3].upper()}-{i+1:02d}",
                "name": f"{disc} Package",
                "discipline": disc,
                "contractor": ctr,
                "value_cr": round(rnd.uniform(80, 1200), 1),
                "progress": rnd.randint(15, 90),
                "status": "Active",
                "created_at": now_iso(),
            })
            package_ids.append((pkg_id, pid, ctr, disc, pcode))

    # Milestones
    milestone_cats = [
        ("Engineering Approval", "Engineering"),
        ("Procurement Order", "Procurement"),
        ("Civil Foundation Cast", "Construction"),
        ("Mechanical Erection", "Construction"),
        ("Testing & Commissioning", "Commissioning"),
        ("Handover", "Project"),
    ]
    statuses_m = ["Completed", "In Progress", "Upcoming", "Delayed"]
    for pid, pcode, _ in project_ids:
        for i, (nm, cat) in enumerate(milestone_cats):
            base = datetime(2025, 6, 1) + timedelta(days=i * 90)
            actual = base + timedelta(days=rnd.randint(-15, 45))
            st = rnd.choice(statuses_m)
            await db.milestones.insert_one({
                "id": uid(),
                "project_id": pid,
                "name": nm,
                "category": cat,
                "planned_date": base.date().isoformat(),
                "baseline_date": base.date().isoformat(),
                "actual_date": actual.date().isoformat() if st == "Completed" else None,
                "status": st,
                "responsible": "MECON",
            })

    # Drawings
    drawing_disc = ["Civil", "Structural", "Mechanical", "Electrical", "Piping", "P&ID"]
    statuses_d = ["Submitted", "Under Review", "Approved", "Rejected", "Approved", "Approved"]
    for pkg_id, pid, ctr, disc, pcode in package_ids[:18]:
        for i in range(rnd.randint(2, 5)):
            st = rnd.choice(statuses_d)
            sub = datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))
            await db.drawings.insert_one({
                "id": uid(),
                "project_id": pid,
                "package_id": pkg_id,
                "drawing_number": f"{pcode}-{disc[:3].upper()}-DWG-{rnd.randint(1000, 9999)}",
                "title": f"{disc} GA Drawing Rev {i+1}",
                "discipline": disc,
                "originator": ctr,
                "revision": f"R{i}",
                "status": st,
                "submitted_at": sub.isoformat(),
                "approved_at": (sub + timedelta(days=rnd.randint(2, 10))).isoformat() if st == "Approved" else None,
            })

    # DPRs
    for pkg_id, pid, ctr, disc, pcode in package_ids:
        for d in range(rnd.randint(2, 6)):
            dt = (datetime.now(timezone.utc) - timedelta(days=d)).date().isoformat()
            planned = round(rnd.uniform(1.5, 4.0), 2)
            actual = round(planned + rnd.uniform(-1.2, 0.8), 2)
            await db.dpr.insert_one({
                "id": uid(),
                "project_id": pid,
                "package_id": pkg_id,
                "date": dt,
                "planned_pct": planned,
                "actual_pct": actual,
                "variance": round(actual - planned, 2),
                "manpower": rnd.randint(40, 220),
                "equipment": rnd.randint(4, 18),
                "activities": f"{disc} works as per schedule – pile cap, rebar, formwork",
                "status": rnd.choice(["Submitted", "Verified", "Verified", "Verified"]),
                "submitted_by": ctr,
                "submitted_at": now_iso(),
            })

    # NCRs
    severities = ["Critical", "High", "Medium", "Low"]
    ncr_descs = [
        "Concrete cube test failed at 7 days – M40",
        "Weld defects observed in column splice joints",
        "Misalignment of bolt holes in structural beam",
        "Cable tray support spacing exceeds spec",
        "Painting DFT below specification on equipment",
        "Foundation bolt protrusion length incorrect",
        "Piping slope deviation in steam line",
        "Earth pit resistance above 2 ohm limit",
    ]
    for i in range(22):
        pkg_id, pid, ctr, disc, pcode = rnd.choice(package_ids)
        sev = rnd.choice(severities)
        is_open = rnd.random() < 0.55
        raised = datetime.now(timezone.utc) - timedelta(days=rnd.randint(2, 90))
        await db.ncrs.insert_one({
            "id": uid(),
            "project_id": pid,
            "package_id": pkg_id,
            "ncr_number": f"NCR-2026-{i+1:04d}",
            "description": rnd.choice(ncr_descs),
            "severity": sev,
            "responsible": ctr,
            "target_closure": (raised + timedelta(days=14)).date().isoformat(),
            "status": "Open" if is_open else "Closed",
            "raised_by": "QA/QC Team",
            "raised_at": raised.isoformat(),
            "closed_at": (raised + timedelta(days=rnd.randint(5, 25))).isoformat() if not is_open else None,
        })

    # Hindrances
    hind_types = ["Land Availability", "Drawing Delay", "Material Non-Availability", "Equipment Unavailability", "Weather", "Client Constraint", "Regulatory", "Access Restriction"]
    hind_descs = [
        "Right of way pending at chainage 4+200",
        "Approved-for-construction drawings pending from engineering",
        "TMT bar consignment delayed by supplier",
        "Crane unavailable due to scheduled maintenance",
        "Heavy rain forecasted – concreting on hold",
        "Client clarification awaited on layout change",
        "Forest clearance pending for transmission corridor",
        "Approach road washed away by floods",
    ]
    for i in range(20):
        pkg_id, pid, ctr, disc, pcode = rnd.choice(package_ids)
        sev = rnd.choice(severities)
        is_open = rnd.random() < 0.6
        raised = datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))
        await db.hindrances.insert_one({
            "id": uid(),
            "project_id": pid,
            "package_id": pkg_id,
            "hindrance_number": f"HND-2026-{i+1:04d}",
            "type": rnd.choice(hind_types),
            "severity": sev,
            "description": rnd.choice(hind_descs),
            "responsible": rnd.choice([ctr, "Client", "MECON Engineering"]),
            "target_closure": (raised + timedelta(days=10)).date().isoformat(),
            "status": "Open" if is_open else "Closed",
            "raised_by": "Site Engineer",
            "raised_at": raised.isoformat(),
            "resolved_at": (raised + timedelta(days=rnd.randint(3, 18))).isoformat() if not is_open else None,
        })

    # Bills
    stages = ["Submitted", "Measurement", "Site Verification", "Coordinator Review", "Finance Review", "SAP Processing", "Paid"]
    for i in range(28):
        pkg_id, pid, ctr, disc, pcode = rnd.choice(package_ids)
        cur = rnd.choice(stages)
        await db.bills.insert_one({
            "id": uid(),
            "project_id": pid,
            "package_id": pkg_id,
            "bill_number": f"RA-{pcode}-{i+1:03d}",
            "type": rnd.choice(["RA", "RA", "RA", "Final", "Advance"]),
            "contractor": ctr,
            "value_lakh": round(rnd.uniform(45, 850), 2),
            "submission_date": (datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))).isoformat(),
            "current_stage": cur,
            "status": "Paid" if cur == "Paid" else "Under Review",
            "payment_status": "Released" if cur == "Paid" else "Pending",
            "withheld_lakh": round(rnd.uniform(0, 25), 2),
            "aging_days": rnd.randint(2, 45),
        })

    # Workflows
    wf_types = ["drawing", "bill", "ncr", "hindrance", "dpr"]
    wf_priorities = ["Critical", "High", "Medium", "Low"]
    wf_stages_seed = ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator"]
    wf_status = ["Pending", "In Progress", "Approved", "Rejected", "Escalated"]
    for i in range(35):
        pkg_id, pid, ctr, disc, pcode = rnd.choice(package_ids)
        wt = rnd.choice(wf_types)
        await db.workflows.insert_one({
            "id": uid(),
            "project_id": pid,
            "package_id": pkg_id,
            "type": wt,
            "title": f"{wt.upper()} approval – {disc} package {pcode}",
            "priority": rnd.choice(wf_priorities),
            "sla_hours": rnd.choice([24, 48, 72, 96]),
            "raised_by": ctr,
            "raised_at": (datetime.now(timezone.utc) - timedelta(hours=rnd.randint(2, 200))).isoformat(),
            "assigned_to": "Project Coordinator",
            "current_stage": rnd.choice(wf_stages_seed),
            "status": rnd.choice(wf_status),
            "history": [],
        })

    # Notifications
    notif_titles = [
        ("Critical NCR raised", "danger", "NCR-2026-0008 marked Critical for L&T Construction"),
        ("Bill aging over 30 days", "warning", "RA-BSP-EXP-3-014 pending Finance Review for 32 days"),
        ("Milestone delayed", "warning", "Mechanical Erection milestone delayed by 12 days"),
        ("New drawing submitted", "info", "BSP-EXP-3-CIV-DWG-4521 awaits approval"),
        ("Hindrance closed", "success", "HND-2026-0007 resolved successfully"),
        ("DPR verified", "success", "Daily Progress Report verified by Site Incharge"),
        ("Workflow escalated", "danger", "Drawing approval workflow escalated to CGM"),
        ("Inspection due today", "warning", "Joint inspection scheduled for foundation pour"),
    ]
    for i, (t, sev, msg) in enumerate(notif_titles * 2):
        await db.notifications.insert_one({
            "id": uid(),
            "user_id": "all",
            "type": t,
            "severity": sev,
            "title": t,
            "message": msg,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=i * 3)).isoformat(),
            "read": False,
        })

    # WBS hierarchy + Activities (for Gantt)
    await _seed_wbs_and_activities(project_ids, rnd)

    logger.info("Seed completed successfully")


async def _seed_wbs_and_activities(project_ids, rnd):
    wbs_areas = [
        ("Engineering", ["Process Design", "Civil Design", "Mechanical Design", "Electrical Design"]),
        ("Procurement", ["Material Sourcing", "Vendor Mgmt", "Logistics"]),
        ("Construction", ["Civil Works", "Structural Erection", "Mechanical Erection", "Electrical Installation", "Piping", "Commissioning"]),
    ]
    for pid, pcode, pname in project_ids:
        # Level 1: project root
        root_id = uid()
        await db.wbs.insert_one({
            "id": root_id, "project_id": pid, "parent_id": None,
            "code": pcode, "name": pname, "level": 1,
            "weightage": 100, "progress": rnd.randint(20, 70),
            "planned_start": "2024-04-01", "planned_end": "2027-12-31",
            "actual_start": "2024-04-15", "actual_end": None,
            "status": "In Progress",
        })
        for ai, (area, subs) in enumerate(wbs_areas):
            area_id = uid()
            area_start = datetime(2024 + ai // 2, 4 + ai * 2, 1)
            area_end = area_start + timedelta(days=600)
            await db.wbs.insert_one({
                "id": area_id, "project_id": pid, "parent_id": root_id,
                "code": f"{pcode}.{ai+1}", "name": area, "level": 2,
                "weightage": [25, 25, 50][ai],
                "progress": rnd.randint(15, 80),
                "planned_start": area_start.date().isoformat(),
                "planned_end": area_end.date().isoformat(),
                "actual_start": area_start.date().isoformat(),
                "actual_end": None, "status": "In Progress",
            })
            for si, sub in enumerate(subs):
                sub_id = uid()
                sub_start = area_start + timedelta(days=si * 90)
                sub_end = sub_start + timedelta(days=180 + rnd.randint(30, 120))
                progress = rnd.randint(0, 100)
                status = "Completed" if progress >= 100 else ("In Progress" if progress > 0 else "Not Started")
                await db.wbs.insert_one({
                    "id": sub_id, "project_id": pid, "parent_id": area_id,
                    "code": f"{pcode}.{ai+1}.{si+1}", "name": sub, "level": 3,
                    "weightage": round(100 / len(subs), 1),
                    "progress": progress,
                    "planned_start": sub_start.date().isoformat(),
                    "planned_end": sub_end.date().isoformat(),
                    "actual_start": sub_start.date().isoformat() if progress > 0 else None,
                    "actual_end": sub_end.date().isoformat() if progress >= 100 else None,
                    "status": status,
                })
                for ti in range(rnd.randint(2, 4)):
                    task_id = uid()
                    task_start = sub_start + timedelta(days=ti * 45)
                    task_end = task_start + timedelta(days=60 + rnd.randint(15, 75))
                    t_progress = rnd.randint(0, 100)
                    t_status = "Completed" if t_progress >= 100 else ("In Progress" if t_progress > 0 else "Not Started")
                    task_name = f"{sub} – Activity {ti+1}"
                    await db.wbs.insert_one({
                        "id": task_id, "project_id": pid, "parent_id": sub_id,
                        "code": f"{pcode}.{ai+1}.{si+1}.{ti+1}",
                        "name": task_name, "level": 4,
                        "weightage": round(100 / max(1, rnd.randint(2, 4)), 1),
                        "progress": t_progress,
                        "planned_start": task_start.date().isoformat(),
                        "planned_end": task_end.date().isoformat(),
                        "actual_start": task_start.date().isoformat() if t_progress > 0 else None,
                        "actual_end": task_end.date().isoformat() if t_progress >= 100 else None,
                        "status": t_status,
                    })
                    await db.activities.insert_one({
                        "id": uid(), "project_id": pid, "wbs_id": task_id,
                        "code": f"{pcode}.{ai+1}.{si+1}.{ti+1}",
                        "name": task_name, "area": area,
                        "planned_start": task_start.date().isoformat(),
                        "planned_end": task_end.date().isoformat(),
                        "actual_start": task_start.date().isoformat() if t_progress > 0 else None,
                        "actual_end": task_end.date().isoformat() if t_progress >= 100 else None,
                        "progress": t_progress, "status": t_status,
                        "is_critical": rnd.random() < 0.25,
                    })


@app.on_event("startup")
async def on_startup():
    try:
        await seed_admin_and_demo()
    except Exception as e:
        logger.exception(f"Seed failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
