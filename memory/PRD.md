# MECON Integrated Project Monitoring Platform — PRD

## Original Problem Statement
Build an enterprise-level Project Monitoring System for MECON Limited based on the supplied MECON Functional Requirement Specification (`MECON_Requirement___08.06.2026 final afternoon.docx`). The FRS spans 16 modules (UI/UX, Workflow & Approval, Project Planning & Execution, Progress Tracking, Hindrance Management, Notifications, Drawing & Document Approval, Engineering Deliverable Planning, Quality & Inspection, Performance Reports & Analytics, Finance & Billing, User Role & Access Management, Mobile, Scalability, Audit/Traceability, Cybersecurity, AI/Future Readiness) — built as "Enterprise Project Command Center".

## Architecture
- **Backend**: FastAPI (Python 3) + Motor (MongoDB async) + JWT (PyJWT) + bcrypt — single `/app/backend/server.py`. All routes under `/api`. Idempotent admin + demo-user + sample-data seeding on startup.
- **Frontend**: React 19 + React Router 7 + Tailwind 3 + Recharts + lucide-react. Chivo + IBM Plex Sans typography. Swiss / high-contrast "Control Room" design. JWT Bearer token via axios interceptor (localStorage key: `mecon_token`).
- **Database**: MongoDB. Collections: users, projects, packages, milestones, progress_curve, drawings, dpr, ncrs, hindrances, bills, workflows, notifications.

## User Personas
- **Administrator** (admin@mecon.in) — full CRUD, user mgmt, all modules.
- **Project Coordinator** (pc@mecon.in) — projects, packages, workflow approvals.
- **Site Engineer** (site@mecon.in) — DPR verification, hindrance closure.
- **QA/QC Engineer** (qaqc@mecon.in) — NCR creation/closure, inspections.
- **Finance Officer** (finance@mecon.in) — bill lifecycle monitoring.
- **Contractor** (contractor@lnt.com) — DPR submission, bill submission (read-mostly).
- **Client** (client@sail.in) — read-only portfolio view.

## Phase-1 MVP (Completed — 2026-02)
- ✅ JWT auth + RBAC across 9 roles, admin seeding, 6 demo accounts
- ✅ Command Center dashboard (8 KPI tiles, S-curve portfolio bar chart, contractor performance ranking with letter grades A+ → D, CCTV thumbnails, My Actions widget, Alerts feed)
- ✅ Projects portfolio with health badges + Project detail (S-Curve area chart, Packages table, Milestones)
- ✅ Workflows module (35 seeded items, approve/reject/escalate actions, status-gated buttons, filters)
- ✅ Drawings & Document Approval (KPI tiles, approve/reject, filter tabs)
- ✅ DPR module (planned/actual variance, manpower, equipment, verify action)
- ✅ Quality & NCR (severity-coded register, close action)
- ✅ Hindrance Management (register, severity, resolve action)
- ✅ Finance & Billing (7-column lifecycle Kanban, financial KPIs, advance action)
- ✅ Performance Analytics (4 charts: portfolio health, contractor ranking, NCR/Hindrance pies)
- ✅ My Actions personalised worklist
- ✅ Global notification panel with severity colour coding
- ✅ Seed: 5 mega-projects (BSP-EXP-3, RSP-COKE-7, NMDC-IRON, PWR-NTPC, BHEL-MFG), 30 packages, ~50 drawings, ~150 DPRs, 22 NCRs, 20 hindrances, 28 bills, 35 workflows, 16 notifications

## Test Coverage
- Backend pytest: **41/41 passing** (100%) — auth, RBAC, dashboard, project overview, all CRUD & action endpoints.
- Frontend Playwright: **95% pass** — all routes navigable, all action buttons fire correctly.
- Test report: `/app/test_reports/iteration_1.json`. Backend tests: `/app/backend/tests/test_mecon_backend.py`.

## Backlog (P1 / P2 / Phase-2)
### P1 — High value next steps
- Create-project / create-NCR / create-hindrance / create-DPR forms (currently POST endpoints exist but no UI forms)
- WBS multi-level tree explorer (currently only packages — extend to 10+ level hierarchy per FRS)
- Gantt timeline view of activities + critical path visualisation
- Workflow history & escalation timeline drawer (history array exists in model, no UI yet)
- Drawing revision diff + transmittal management
- Engineering Deliverable Planning module (MDDR / Master Drawing & Document Register with compliance status)
- Bulk import (CSV / Primavera P6 / MS Project schedule import)
- Audit log explorer page (all activities → `audit_logs` collection)

### P2 — Advanced
- AI contractor risk prediction & delay forecasting (Claude / GPT-5.2)
- Mobile-responsive PWA with offline DPR capture & sync
- Real CCTV NVR integration + drone feed support
- SAP / ERP integration adapters (Phase-2 finance handoff)
- LDAP / SSO / MFA
- Power BI / advanced report export
- Configurable workflow templates UI
- SLA breach analytics & bottleneck root-cause analysis

### P0 — Production hardening before deploy
- Rotate `JWT_SECRET` to a runtime-generated secret per environment
- Lock CORS to specific origins
- Split `server.py` into routers (auth, projects, finance, etc.)
- Add structured audit logging (every mutating action → audit collection)
- Add MongoDB unique indexes for ncr_number, hindrance_number, bill_number
- Rate limit `/api/auth/login`

## Files Touched
- `/app/backend/server.py` (rewrite — 950+ lines)
- `/app/backend/.env` (added JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, FRONTEND_URL)
- `/app/frontend/src/App.js` (rewrite)
- `/app/frontend/src/index.css` (rewrite — fonts + tokens)
- `/app/frontend/src/api/client.js` (new)
- `/app/frontend/src/contexts/AuthContext.js` (new)
- `/app/frontend/src/components/{Layout,ProtectedRoute,KpiCard,StatusBadge}.js` (new)
- `/app/frontend/src/pages/{Login,Dashboard,Projects,ProjectDetail,Workflows,Drawings,DPR,Quality,Hindrances,Finance,Analytics,MyActions}.js` (new)
- `/app/memory/test_credentials.md` (updated)
