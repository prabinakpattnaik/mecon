import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import KpiCard from "../components/KpiCard";
import { ChevronLeft, FileWarning, AlertTriangle, FileText, Receipt } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from "recharts";

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/projects/${id}/overview`).then((r) => setData(r.data));
  }, [id]);

  if (!data) return <div className="text-overline text-slate-500">Loading project…</div>;
  const { project, packages, milestones, kpis, curve } = data;

  return (
    <div className="space-y-5" data-testid="project-detail-root">
      <Link to="/projects" className="text-xs text-slate-600 hover:text-blue-700 inline-flex items-center gap-1" data-testid="back-to-projects">
        <ChevronLeft className="w-3.5 h-3.5" /> All Projects
      </Link>

      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[11px] text-slate-500">{project.code}</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-0.5">{project.name}</h1>
          <p className="text-sm text-slate-600 mt-1">{project.client} · {project.location}</p>
        </div>
        <StatusBadge value={project.health} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard testId="proj-kpi-planned" label="Planned" value={`${project.planned_progress}%`} accent="slate" />
        <KpiCard testId="proj-kpi-actual" label="Actual" value={`${project.actual_progress}%`} accent={project.actual_progress < project.planned_progress ? "red" : "emerald"} />
        <KpiCard testId="proj-kpi-value" label="Contract Value" value={`₹${project.value_cr}`} unit="Cr" accent="blue" />
        <KpiCard testId="proj-kpi-pending-drawings" label="Pending Drawings" value={kpis.pending_drawings} accent="amber" icon={FileText} />
        <KpiCard testId="proj-kpi-open-ncrs" label="Open NCRs" value={kpis.open_ncrs} accent="red" icon={FileWarning} />
        <KpiCard testId="proj-kpi-open-hindrances" label="Open Hindrances" value={kpis.open_hindrances} accent="amber" icon={AlertTriangle} />
        <KpiCard testId="proj-kpi-pending-bills" label="Bills In Pipeline" value={kpis.pending_bills} accent="slate" icon={Receipt} />
        <KpiCard testId="proj-kpi-packages" label="Packages" value={packages.length} accent="blue" />
      </div>

      {/* S-Curve */}
      <div className="card-flat p-5">
        <div className="text-overline">Progress S-Curve</div>
        <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Planned vs Actual Cumulative (24 weeks)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curve}>
            <defs>
              <linearGradient id="gPlanned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "Week", fontSize: 10, fill: "#64748b", position: "insideBottomRight", offset: -5 }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="planned" stroke="#94a3b8" fill="url(#gPlanned)" name="Planned" strokeWidth={2} />
            <Area type="monotone" dataKey="actual" stroke="#1d4ed8" fill="url(#gActual)" name="Actual" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Packages */}
      <div className="card-flat p-5">
        <div className="text-overline">Work Breakdown</div>
        <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Packages ({packages.length})</h3>
        <div className="overflow-x-auto border border-slate-200 rounded-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-overline text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Discipline</th>
                <th className="text-left px-3 py-2">Contractor</th>
                <th className="text-right px-3 py-2">Value (Cr)</th>
                <th className="text-left px-3 py-2 w-48">Progress</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{p.code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{p.discipline}</td>
                  <td className="px-3 py-2 text-slate-700">{p.contractor}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{p.value_cr}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-700" style={{ width: `${p.progress}%` }}></div>
                      </div>
                      <span className="text-xs font-mono text-slate-700 w-9 text-right">{p.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Milestones */}
      <div className="card-flat p-5">
        <div className="text-overline">Milestones</div>
        <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Key contractual milestones</h3>
        <div className="space-y-1.5">
          {milestones.map((m) => (
            <div key={m.id} className="grid grid-cols-12 items-center gap-3 border-b border-slate-100 py-2 text-sm">
              <div className="col-span-5">
                <div className="font-medium text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">{m.category}</div>
              </div>
              <div className="col-span-2 text-xs font-mono text-slate-600">{m.planned_date}</div>
              <div className="col-span-3 text-xs text-slate-700">{m.actual_date ? `Actual: ${m.actual_date}` : "—"}</div>
              <div className="col-span-2"><StatusBadge value={m.status} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
