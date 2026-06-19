import React, { useEffect, useState } from "react";
import api from "../api/client";
import KpiCard from "../components/KpiCard";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  AlertCircle,
  AlertTriangle,
  FileWarning,
  GitBranch,
  Receipt,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [actions, setActions] = useState([]);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/summary"),
      api.get("/my-actions"),
      api.get("/notifications"),
    ]).then(([s, a, n]) => {
      setData(s.data);
      setActions(a.data);
      setNotifs(n.data);
    });
  }, []);

  if (!data)
    return <div className="text-overline text-slate-500" data-testid="dashboard-loading">Loading command center…</div>;

  const k = data.kpis;

  return (
    <div className="space-y-6" data-testid="dashboard-root">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-overline">Command Center</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enterprise portfolio overview · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-overline">Live</div>
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard testId="kpi-active-projects" label="Active Projects" value={k.active_projects} unit={`/ ${k.total_projects}`} accent="blue" icon={FolderKanban} />
        <KpiCard testId="kpi-delayed-projects" label="Critical (Red)" value={k.delayed_projects} unit="projects" accent="red" icon={AlertCircle} />
        <KpiCard testId="kpi-amber-projects" label="At-Risk (Amber)" value={k.amber_projects} unit="projects" accent="amber" icon={AlertTriangle} />
        <KpiCard testId="kpi-open-ncrs" label="Open NCRs" value={k.open_ncrs} accent="red" icon={FileWarning} />
        <KpiCard testId="kpi-open-hindrances" label="Open Hindrances" value={k.open_hindrances} accent="amber" icon={AlertTriangle} />
        <KpiCard testId="kpi-pending-drawings" label="Drawings Pending" value={k.pending_drawings} accent="slate" icon={FileWarning} />
        <KpiCard testId="kpi-pending-workflows" label="Pending Workflows" value={k.pending_workflows} accent="slate" icon={GitBranch} />
        <KpiCard testId="kpi-outstanding" label="Outstanding (Receivable)" value={`₹${(k.outstanding_lakh / 100).toFixed(1)}`} unit="Cr" accent="emerald" icon={IndianRupee} />
      </div>

      {/* Portfolio progress + Contractor performance */}
      <div className="grid grid-cols-12 gap-5">
        <div className="card-flat col-span-12 lg:col-span-8 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-overline">Portfolio Progress</div>
              <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">
                Planned vs Actual — All Active Projects
              </h3>
            </div>
            <TrendingUp className="w-4 h-4 text-blue-700" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.portfolio_progress} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2, border: "1px solid #e2e8f0" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="planned" fill="#94a3b8" name="Planned %" />
              <Bar dataKey="actual" fill="#1d4ed8" name="Actual %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat col-span-12 lg:col-span-4 p-5">
          <div className="text-overline">Contractor Performance</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">AI Rating Engine</h3>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
            {data.contractor_performance.map((c) => (
              <div key={c.contractor} className="flex items-center justify-between border-b border-slate-100 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-900 truncate">{c.contractor}</div>
                  <div className="text-[11px] text-slate-500">{c.packages} packages · avg {c.avg_progress}%</div>
                </div>
                <div className={`px-2 py-1 rounded-sm text-xs font-bold font-mono border ${
                  c.grade === "A+" || c.grade === "A"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : c.grade === "B"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : c.grade === "C"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>{c.grade}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Actions + Alerts */}
      <div className="grid grid-cols-12 gap-5">
        <div className="card-flat col-span-12 lg:col-span-7 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-overline">My Actions</div>
              <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">Pending items for you</h3>
            </div>
            <Link to="/my-actions" className="text-xs text-blue-700 font-semibold hover:underline" data-testid="dashboard-view-all-actions">View all →</Link>
          </div>
          <div className="overflow-hidden border border-slate-200 rounded-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-overline text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2">Priority</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 8).map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide">{a.type}</td>
                    <td className="px-3 py-2 text-slate-900 truncate max-w-md">{a.title}</td>
                    <td className="px-3 py-2"><StatusBadge value={a.priority} /></td>
                  </tr>
                ))}
                {actions.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-slate-500 text-sm p-6">No pending actions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-flat col-span-12 lg:col-span-5 p-5">
          <div className="text-overline">Recent Alerts</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Notifications feed</h3>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {notifs.slice(0, 8).map((n) => (
              <div key={n.id} className="flex items-start gap-2 border-b border-slate-100 pb-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${
                  n.severity === "danger" ? "bg-red-600"
                  : n.severity === "warning" ? "bg-amber-500"
                  : n.severity === "success" ? "bg-emerald-600"
                  : "bg-sky-500"
                }`}></span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-slate-900">{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CCTV preview row */}
      <div className="card-flat p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-overline">Live Site Monitoring</div>
            <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">CCTV Feed Snapshots</h3>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 4 cameras online
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative rounded-sm overflow-hidden border border-slate-200 bg-slate-900 aspect-video" data-testid={`cctv-feed-${i}`}>
              <img src="https://images.unsplash.com/photo-1772299121503-cd62a57e3a26?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" alt="CCTV" className="w-full h-full object-cover opacity-90" />
              <div className="absolute top-2 left-2 text-[10px] text-white bg-black/60 px-1.5 py-0.5 font-mono">
                CAM-{i.toString().padStart(2, "0")} · LIVE
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] text-white bg-red-600 px-1.5 py-0.5 font-bold rounded-sm flex items-center gap-1">
                <span className="w-1 h-1 bg-white rounded-full"></span> REC
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
