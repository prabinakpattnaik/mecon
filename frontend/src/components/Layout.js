import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  GitBranch,
  FileText,
  ClipboardList,
  ShieldAlert,
  AlertTriangle,
  Receipt,
  BarChart3,
  BellRing,
  CheckSquare,
  LogOut,
  Search,
  Building2,
  CircleUser,
  Settings2,
  ScrollText,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/client";

const NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/my-actions", label: "My Actions", icon: CheckSquare, testId: "nav-my-actions" },
  { to: "/projects", label: "Projects", icon: FolderKanban, testId: "nav-projects" },
  { to: "/workflows", label: "Workflows", icon: GitBranch, testId: "nav-workflows" },
  { to: "/drawings", label: "Drawings & Docs", icon: FileText, testId: "nav-drawings" },
  { to: "/dpr", label: "Daily Progress (DPR)", icon: ClipboardList, testId: "nav-dpr" },
  { to: "/quality", label: "Quality & NCR", icon: ShieldAlert, testId: "nav-quality" },
  { to: "/hindrances", label: "Hindrances", icon: AlertTriangle, testId: "nav-hindrances" },
  { to: "/finance", label: "Finance & Billing", icon: Receipt, testId: "nav-finance" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testId: "nav-analytics" },
];

const ADMIN_NAV = [
  { to: "/workflow-templates", label: "Workflow Templates", icon: Settings2, testId: "nav-workflow-templates" },
  { to: "/audit-log", label: "Audit Log", icon: ScrollText, testId: "nav-audit-log" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    api.get("/notifications").then((r) => setNotifs(r.data || [])).catch(() => {});
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-sm flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-white text-[15px] tracking-tight">MECON</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Command Center</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-white border-l-2 border-blue-500 pl-[10px]"
                    : "hover:bg-slate-800/60 hover:text-white"
                }`
              }
            >
              <n.icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{n.label}</span>
            </NavLink>
          ))}

          {user && ["admin", "ProjectCoordinator"].includes(user.role) && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-3 pt-5 pb-1">Admin</div>
              {ADMIN_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  data-testid={n.testId}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-sm text-[13px] transition-colors ${
                      isActive
                        ? "bg-blue-600/20 text-white border-l-2 border-blue-500 pl-[10px]"
                        : "hover:bg-slate-800/60 hover:text-white"
                    }`
                  }
                >
                  <n.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{n.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 bg-slate-700 rounded-sm flex items-center justify-center">
              <CircleUser className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-white truncate" data-testid="sidebar-user-name">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="text-slate-400 hover:text-white p-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                data-testid="global-search-input"
                placeholder="Search drawings, NCRs, bills, workflows…"
                className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                {user?.organization}
              </div>
              <button
                data-testid="notifications-button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 hover:bg-slate-100 rounded-sm"
              >
                <BellRing className="w-4 h-4 text-slate-700" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-red-600 text-white rounded-full">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </div>
          </div>
          {notifOpen && (
            <div className="absolute right-6 top-14 w-96 bg-white border border-slate-200 rounded-sm shadow-lg z-30" data-testid="notifications-panel">
              <div className="px-4 py-2 border-b border-slate-200 text-overline">Notifications</div>
              <div className="max-h-96 overflow-y-auto">
                {notifs.length === 0 && <div className="p-4 text-sm text-slate-500">No notifications yet</div>}
                {notifs.slice(0, 12).map((n) => (
                  <div key={n.id} className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                    <div className="flex items-start gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          n.severity === "danger"
                            ? "bg-red-600"
                            : n.severity === "warning"
                            ? "bg-amber-500"
                            : n.severity === "success"
                            ? "bg-emerald-600"
                            : "bg-sky-500"
                        }`}
                      ></span>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-slate-900">{n.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
        <footer className="px-6 py-3 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex justify-between">
          <span>MECON Limited © 2026 — Integrated Project Monitoring Platform</span>
          <span className="font-mono">v1.0.0 · Phase-1 MVP</span>
        </footer>
      </div>
    </div>
  );
}
