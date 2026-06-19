"""MECON Project Monitoring Platform — Demo Seeding.

NOTE: This module uses Python's `random` module. The usage is **NOT
security-sensitive** — it generates deterministic demo data using a
seeded `random.Random(42)` instance so the platform shows the same
realistic numbers across restarts. Using `secrets` would be incorrect
here because cryptographic randomness cannot be seeded for
reproducibility.
"""

from __future__ import annotations
import os
import uuid
import random  # noqa: S311  (demo data only; see module docstring)
import logging
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import List, Tuple

logger = logging.getLogger("mecon.seed")


def _uid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def _verify(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


# ---------------- Demo data tables ----------------
DEMO_USERS = [
    ("pc@mecon.in", "Demo@2026", "Rajesh Kumar", "ProjectCoordinator", "MECON Limited"),
    ("site@mecon.in", "Demo@2026", "Anita Sharma", "SiteEngineer", "MECON Limited"),
    ("qaqc@mecon.in", "Demo@2026", "Vikram Singh", "QAQCEngineer", "MECON Limited"),
    ("finance@mecon.in", "Demo@2026", "Priya Patel", "FinanceOfficer", "MECON Limited"),
    ("contractor@lnt.com", "Demo@2026", "Suresh Iyer", "Contractor", "L&T Construction"),
    ("client@sail.in", "Demo@2026", "Amit Banerjee", "Client", "SAIL"),
]

PROJECT_DEFS = [
    ("BSP-EXP-3", "Bhilai Steel Plant Expansion Phase-3", "SAIL", "Bhilai, Chhattisgarh", "2024-04-01", "2027-03-31", 8540.0, 62, 58, "amber"),
    ("RSP-COKE-7", "Rourkela Coke Oven Battery #7", "SAIL", "Rourkela, Odisha", "2025-01-15", "2027-12-31", 3200.0, 41, 44, "green"),
    ("NMDC-IRON", "NMDC Iron Ore Beneficiation Plant", "NMDC Limited", "Bacheli, Chhattisgarh", "2024-08-10", "2027-06-30", 5680.0, 55, 49, "amber"),
    ("PWR-NTPC", "NTPC Talcher Super Thermal Stg-3", "NTPC", "Talcher, Odisha", "2024-02-01", "2028-01-31", 12340.0, 38, 34, "red"),
    ("BHEL-MFG", "BHEL Bhopal Heavy Equipment Mfg Bay", "BHEL", "Bhopal, MP", "2025-05-01", "2027-04-30", 1850.0, 22, 26, "green"),
]

DISCIPLINES = ["Civil", "Structural", "Mechanical", "Electrical", "Instrumentation", "Piping"]
CONTRACTORS = ["L&T Construction", "Tata Projects", "Afcons Infrastructure", "Punj Lloyd", "ISGEC", "BHEL"]
SEVERITIES = ["Critical", "High", "Medium", "Low"]

MILESTONE_CATS = [
    ("Engineering Approval", "Engineering"),
    ("Procurement Order", "Procurement"),
    ("Civil Foundation Cast", "Construction"),
    ("Mechanical Erection", "Construction"),
    ("Testing & Commissioning", "Commissioning"),
    ("Handover", "Project"),
]
MILESTONE_STATUSES = ["Completed", "In Progress", "Upcoming", "Delayed"]

DRAWING_DISCIPLINES = ["Civil", "Structural", "Mechanical", "Electrical", "Piping", "P&ID"]
DRAWING_STATUSES = ["Submitted", "Under Review", "Approved", "Rejected", "Approved", "Approved"]

NCR_DESCRIPTIONS = [
    "Concrete cube test failed at 7 days – M40",
    "Weld defects observed in column splice joints",
    "Misalignment of bolt holes in structural beam",
    "Cable tray support spacing exceeds spec",
    "Painting DFT below specification on equipment",
    "Foundation bolt protrusion length incorrect",
    "Piping slope deviation in steam line",
    "Earth pit resistance above 2 ohm limit",
]

HINDRANCE_TYPES = ["Land Availability", "Drawing Delay", "Material Non-Availability", "Equipment Unavailability", "Weather", "Client Constraint", "Regulatory", "Access Restriction"]
HINDRANCE_DESCRIPTIONS = [
    "Right of way pending at chainage 4+200",
    "Approved-for-construction drawings pending from engineering",
    "TMT bar consignment delayed by supplier",
    "Crane unavailable due to scheduled maintenance",
    "Heavy rain forecasted – concreting on hold",
    "Client clarification awaited on layout change",
    "Forest clearance pending for transmission corridor",
    "Approach road washed away by floods",
]

BILL_STAGES = ["Submitted", "Measurement", "Site Verification", "Coordinator Review", "Finance Review", "SAP Processing", "Paid"]

WORKFLOW_TYPES = ["drawing", "bill", "ncr", "hindrance", "dpr"]
WORKFLOW_PRIORITIES = ["Critical", "High", "Medium", "Low"]
WORKFLOW_SEED_STAGES = ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator"]
WORKFLOW_STATUSES = ["Pending", "In Progress", "Approved", "Rejected", "Escalated"]

NOTIF_TITLES = [
    ("Critical NCR raised", "danger", "NCR-2026-0008 marked Critical for L&T Construction"),
    ("Bill aging over 30 days", "warning", "RA-BSP-EXP-3-014 pending Finance Review for 32 days"),
    ("Milestone delayed", "warning", "Mechanical Erection milestone delayed by 12 days"),
    ("New drawing submitted", "info", "BSP-EXP-3-CIV-DWG-4521 awaits approval"),
    ("Hindrance closed", "success", "HND-2026-0007 resolved successfully"),
    ("DPR verified", "success", "Daily Progress Report verified by Site Incharge"),
    ("Workflow escalated", "danger", "Drawing approval workflow escalated to CGM"),
    ("Inspection due today", "warning", "Joint inspection scheduled for foundation pour"),
]

WBS_AREAS = [
    ("Engineering", ["Process Design", "Civil Design", "Mechanical Design", "Electrical Design"]),
    ("Procurement", ["Material Sourcing", "Vendor Mgmt", "Logistics"]),
    ("Construction", ["Civil Works", "Structural Erection", "Mechanical Erection", "Electrical Installation", "Piping", "Commissioning"]),
]


# ---------------- Per-collection seeders ----------------
async def _ensure_indexes(db):
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("id")
    await db.packages.create_index("project_id")


async def _ensure_admin_user(db) -> None:
    email = os.environ["ADMIN_EMAIL"].lower()
    pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": _uid(), "email": email, "password_hash": _hash(pw),
            "name": "MECON Administrator", "role": "admin",
            "organization": "MECON Limited", "created_at": _now_iso(),
        })
    elif not _verify(pw, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": _hash(pw)}})


async def _ensure_demo_users(db) -> None:
    for em, pw, nm, rl, og in DEMO_USERS:
        if not await db.users.find_one({"email": em}):
            await db.users.insert_one({
                "id": _uid(), "email": em, "password_hash": _hash(pw),
                "name": nm, "role": rl, "organization": og, "created_at": _now_iso(),
            })


async def _seed_projects_and_curves(db, rnd) -> List[Tuple[str, str, str]]:
    project_ids: List[Tuple[str, str, str]] = []
    for code, name, cli, loc, sd, ed, val, pp, ap, health in PROJECT_DEFS:
        pid = _uid()
        project_ids.append((pid, code, name))
        await db.projects.insert_one({
            "id": pid, "code": code, "name": name, "client": cli, "location": loc,
            "start_date": sd, "end_date": ed, "value_cr": val, "manager": "MECON PMG",
            "description": f"Turnkey EPC monitoring for {name}",
            "planned_progress": pp, "actual_progress": ap, "baseline_progress": pp - 2,
            "health": health, "status": "Active", "created_at": _now_iso(),
        })
        for w in range(1, 25):
            planned = round(min(100, (pp / 24) * w + rnd.uniform(-1, 1)), 1)
            actual = round(min(100, planned + rnd.uniform(-6, 3)), 1)
            await db.progress_curve.insert_one({
                "id": _uid(), "project_id": pid, "week": w,
                "planned": planned, "actual": actual,
            })
    return project_ids


async def _seed_packages(db, project_ids, rnd) -> List[Tuple[str, str, str, str, str]]:
    package_ids: List[Tuple[str, str, str, str, str]] = []
    for pid, pcode, _name in project_ids:
        for i, disc in enumerate(DISCIPLINES):
            pkg_id = _uid()
            ctr = CONTRACTORS[(hash(pcode) + i) % len(CONTRACTORS)]
            await db.packages.insert_one({
                "id": pkg_id, "project_id": pid,
                "code": f"{pcode}-{disc[:3].upper()}-{i+1:02d}",
                "name": f"{disc} Package", "discipline": disc, "contractor": ctr,
                "value_cr": round(rnd.uniform(80, 1200), 1),
                "progress": rnd.randint(15, 90),
                "status": "Active", "created_at": _now_iso(),
            })
            package_ids.append((pkg_id, pid, ctr, disc, pcode))
    return package_ids


async def _seed_milestones(db, project_ids, rnd) -> None:
    for pid, _pcode, _name in project_ids:
        for i, (nm, cat) in enumerate(MILESTONE_CATS):
            base = datetime(2025, 6, 1) + timedelta(days=i * 90)
            actual = base + timedelta(days=rnd.randint(-15, 45))
            st = rnd.choice(MILESTONE_STATUSES)
            await db.milestones.insert_one({
                "id": _uid(), "project_id": pid, "name": nm, "category": cat,
                "planned_date": base.date().isoformat(),
                "baseline_date": base.date().isoformat(),
                "actual_date": actual.date().isoformat() if st == "Completed" else None,
                "status": st, "responsible": "MECON",
            })


async def _seed_drawings(db, package_ids, rnd) -> None:
    for pkg_id, pid, ctr, disc, pcode in package_ids[:18]:
        for i in range(rnd.randint(2, 5)):
            st = rnd.choice(DRAWING_STATUSES)
            sub = datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))
            await db.drawings.insert_one({
                "id": _uid(), "project_id": pid, "package_id": pkg_id,
                "drawing_number": f"{pcode}-{disc[:3].upper()}-DWG-{rnd.randint(1000, 9999)}",
                "title": f"{disc} GA Drawing Rev {i+1}",
                "discipline": disc, "originator": ctr, "revision": f"R{i}",
                "status": st, "submitted_at": sub.isoformat(),
                "approved_at": (sub + timedelta(days=rnd.randint(2, 10))).isoformat() if st == "Approved" else None,
            })


async def _seed_dprs(db, package_ids, rnd) -> None:
    for pkg_id, pid, ctr, disc, _pcode in package_ids:
        for d in range(rnd.randint(2, 6)):
            dt = (datetime.now(timezone.utc) - timedelta(days=d)).date().isoformat()
            planned = round(rnd.uniform(1.5, 4.0), 2)
            actual = round(planned + rnd.uniform(-1.2, 0.8), 2)
            await db.dpr.insert_one({
                "id": _uid(), "project_id": pid, "package_id": pkg_id, "date": dt,
                "planned_pct": planned, "actual_pct": actual,
                "variance": round(actual - planned, 2),
                "manpower": rnd.randint(40, 220), "equipment": rnd.randint(4, 18),
                "activities": f"{disc} works as per schedule – pile cap, rebar, formwork",
                "status": rnd.choice(["Submitted", "Verified", "Verified", "Verified"]),
                "submitted_by": ctr, "submitted_at": _now_iso(),
            })


async def _seed_ncrs(db, package_ids, rnd) -> None:
    for i in range(22):
        pkg_id, pid, ctr, _disc, _pcode = rnd.choice(package_ids)
        sev = rnd.choice(SEVERITIES)
        is_open = rnd.random() < 0.55
        raised = datetime.now(timezone.utc) - timedelta(days=rnd.randint(2, 90))
        await db.ncrs.insert_one({
            "id": _uid(), "project_id": pid, "package_id": pkg_id,
            "ncr_number": f"NCR-2026-{i+1:04d}",
            "description": rnd.choice(NCR_DESCRIPTIONS),
            "severity": sev, "responsible": ctr,
            "target_closure": (raised + timedelta(days=14)).date().isoformat(),
            "status": "Open" if is_open else "Closed",
            "raised_by": "QA/QC Team", "raised_at": raised.isoformat(),
            "closed_at": (raised + timedelta(days=rnd.randint(5, 25))).isoformat() if not is_open else None,
        })


async def _seed_hindrances(db, package_ids, rnd) -> None:
    for i in range(20):
        pkg_id, pid, ctr, _disc, _pcode = rnd.choice(package_ids)
        sev = rnd.choice(SEVERITIES)
        is_open = rnd.random() < 0.6
        raised = datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))
        await db.hindrances.insert_one({
            "id": _uid(), "project_id": pid, "package_id": pkg_id,
            "hindrance_number": f"HND-2026-{i+1:04d}",
            "type": rnd.choice(HINDRANCE_TYPES), "severity": sev,
            "description": rnd.choice(HINDRANCE_DESCRIPTIONS),
            "responsible": rnd.choice([ctr, "Client", "MECON Engineering"]),
            "target_closure": (raised + timedelta(days=10)).date().isoformat(),
            "status": "Open" if is_open else "Closed",
            "raised_by": "Site Engineer", "raised_at": raised.isoformat(),
            "resolved_at": (raised + timedelta(days=rnd.randint(3, 18))).isoformat() if not is_open else None,
        })


async def _seed_bills(db, package_ids, rnd) -> None:
    for i in range(28):
        pkg_id, pid, ctr, _disc, pcode = rnd.choice(package_ids)
        cur = rnd.choice(BILL_STAGES)
        await db.bills.insert_one({
            "id": _uid(), "project_id": pid, "package_id": pkg_id,
            "bill_number": f"RA-{pcode}-{i+1:03d}",
            "type": rnd.choice(["RA", "RA", "RA", "Final", "Advance"]),
            "contractor": ctr, "value_lakh": round(rnd.uniform(45, 850), 2),
            "submission_date": (datetime.now(timezone.utc) - timedelta(days=rnd.randint(1, 60))).isoformat(),
            "current_stage": cur,
            "status": "Paid" if cur == "Paid" else "Under Review",
            "payment_status": "Released" if cur == "Paid" else "Pending",
            "withheld_lakh": round(rnd.uniform(0, 25), 2),
            "aging_days": rnd.randint(2, 45),
        })


async def _seed_workflows(db, package_ids, rnd) -> None:
    for _ in range(35):
        pkg_id, pid, ctr, disc, pcode = rnd.choice(package_ids)
        wt = rnd.choice(WORKFLOW_TYPES)
        await db.workflows.insert_one({
            "id": _uid(), "project_id": pid, "package_id": pkg_id, "type": wt,
            "title": f"{wt.upper()} approval – {disc} package {pcode}",
            "priority": rnd.choice(WORKFLOW_PRIORITIES),
            "sla_hours": rnd.choice([24, 48, 72, 96]),
            "raised_by": ctr,
            "raised_at": (datetime.now(timezone.utc) - timedelta(hours=rnd.randint(2, 200))).isoformat(),
            "assigned_to": "Project Coordinator",
            "current_stage": rnd.choice(WORKFLOW_SEED_STAGES),
            "status": rnd.choice(WORKFLOW_STATUSES), "history": [],
        })


async def _seed_notifications(db) -> None:
    for i, (t, sev, msg) in enumerate(NOTIF_TITLES * 2):
        await db.notifications.insert_one({
            "id": _uid(), "user_id": "all", "type": t, "severity": sev,
            "title": t, "message": msg,
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=i * 3)).isoformat(),
            "read": False,
        })


# ---------------- WBS hierarchy ----------------
async def _seed_wbs_level1_root(db, pid, pcode, pname, rnd) -> str:
    root_id = _uid()
    await db.wbs.insert_one({
        "id": root_id, "project_id": pid, "parent_id": None,
        "code": pcode, "name": pname, "level": 1,
        "weightage": 100, "progress": rnd.randint(20, 70),
        "planned_start": "2024-04-01", "planned_end": "2027-12-31",
        "actual_start": "2024-04-15", "actual_end": None,
        "status": "In Progress",
    })
    return root_id


async def _seed_wbs_level2_area(db, pid, pcode, root_id, ai, area, rnd):
    area_id = _uid()
    area_start = datetime(2024 + ai // 2, 4 + ai * 2, 1)
    area_end = area_start + timedelta(days=600)
    await db.wbs.insert_one({
        "id": area_id, "project_id": pid, "parent_id": root_id,
        "code": f"{pcode}.{ai+1}", "name": area, "level": 2,
        "weightage": [25, 25, 50][ai], "progress": rnd.randint(15, 80),
        "planned_start": area_start.date().isoformat(),
        "planned_end": area_end.date().isoformat(),
        "actual_start": area_start.date().isoformat(),
        "actual_end": None, "status": "In Progress",
    })
    return area_id, area_start


async def _seed_wbs_level3_sub(db, pid, pcode, area_id, ai, si, sub, area_start, total_subs, rnd):
    sub_id = _uid()
    sub_start = area_start + timedelta(days=si * 90)
    sub_end = sub_start + timedelta(days=180 + rnd.randint(30, 120))
    progress = rnd.randint(0, 100)
    status = "Completed" if progress >= 100 else ("In Progress" if progress > 0 else "Not Started")
    await db.wbs.insert_one({
        "id": sub_id, "project_id": pid, "parent_id": area_id,
        "code": f"{pcode}.{ai+1}.{si+1}", "name": sub, "level": 3,
        "weightage": round(100 / total_subs, 1), "progress": progress,
        "planned_start": sub_start.date().isoformat(),
        "planned_end": sub_end.date().isoformat(),
        "actual_start": sub_start.date().isoformat() if progress > 0 else None,
        "actual_end": sub_end.date().isoformat() if progress >= 100 else None,
        "status": status,
    })
    return sub_id, sub_start


async def _seed_wbs_level4_and_activity(db, pid, pcode, sub_id, ai, si, ti, sub, area, sub_start, rnd):
    task_id = _uid()
    task_start = sub_start + timedelta(days=ti * 45)
    task_end = task_start + timedelta(days=60 + rnd.randint(15, 75))
    t_progress = rnd.randint(0, 100)
    t_status = "Completed" if t_progress >= 100 else ("In Progress" if t_progress > 0 else "Not Started")
    task_name = f"{sub} – Activity {ti+1}"
    await db.wbs.insert_one({
        "id": task_id, "project_id": pid, "parent_id": sub_id,
        "code": f"{pcode}.{ai+1}.{si+1}.{ti+1}", "name": task_name, "level": 4,
        "weightage": round(100 / max(1, rnd.randint(2, 4)), 1),
        "progress": t_progress,
        "planned_start": task_start.date().isoformat(),
        "planned_end": task_end.date().isoformat(),
        "actual_start": task_start.date().isoformat() if t_progress > 0 else None,
        "actual_end": task_end.date().isoformat() if t_progress >= 100 else None,
        "status": t_status,
    })
    await db.activities.insert_one({
        "id": _uid(), "project_id": pid, "wbs_id": task_id,
        "code": f"{pcode}.{ai+1}.{si+1}.{ti+1}",
        "name": task_name, "area": area,
        "planned_start": task_start.date().isoformat(),
        "planned_end": task_end.date().isoformat(),
        "actual_start": task_start.date().isoformat() if t_progress > 0 else None,
        "actual_end": task_end.date().isoformat() if t_progress >= 100 else None,
        "progress": t_progress, "status": t_status,
        "is_critical": rnd.random() < 0.25,
    })


async def seed_wbs_and_activities(db, project_ids, rnd) -> None:
    for pid, pcode, pname in project_ids:
        root_id = await _seed_wbs_level1_root(db, pid, pcode, pname, rnd)
        for ai, (area, subs) in enumerate(WBS_AREAS):
            area_id, area_start = await _seed_wbs_level2_area(db, pid, pcode, root_id, ai, area, rnd)
            for si, sub in enumerate(subs):
                sub_id, sub_start = await _seed_wbs_level3_sub(db, pid, pcode, area_id, ai, si, sub, area_start, len(subs), rnd)
                for ti in range(rnd.randint(2, 4)):
                    await _seed_wbs_level4_and_activity(db, pid, pcode, sub_id, ai, si, ti, sub, area, sub_start, rnd)


# ---------------- Orchestrator ----------------
async def seed_admin_and_demo(db) -> None:
    """Idempotent demo seed. Re-seeds WBS if missing, even if projects exist."""
    await _ensure_indexes(db)
    await _ensure_admin_user(db)
    await _ensure_demo_users(db)

    if await db.projects.count_documents({}) > 0:
        # Top-up WBS if a previous deploy was missing them
        if await db.wbs.count_documents({}) == 0:
            rnd = random.Random(42)  # noqa: S311
            existing = await db.projects.find({}, {"_id": 0}).to_list(50)
            project_ids = [(p["id"], p["code"], p["name"]) for p in existing]
            await seed_wbs_and_activities(db, project_ids, rnd)
        return

    rnd = random.Random(42)  # noqa: S311  (seeded for reproducible demo data)
    project_ids = await _seed_projects_and_curves(db, rnd)
    package_ids = await _seed_packages(db, project_ids, rnd)
    await _seed_milestones(db, project_ids, rnd)
    await _seed_drawings(db, package_ids, rnd)
    await _seed_dprs(db, package_ids, rnd)
    await _seed_ncrs(db, package_ids, rnd)
    await _seed_hindrances(db, package_ids, rnd)
    await _seed_bills(db, package_ids, rnd)
    await _seed_workflows(db, package_ids, rnd)
    await _seed_notifications(db)
    await seed_wbs_and_activities(db, project_ids, rnd)
    logger.info("Seed completed successfully")
