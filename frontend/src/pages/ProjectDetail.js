import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import KpiCard from "../components/KpiCard";
import WbsTree from "../components/WbsTree";
import GanttChart from "../components/GanttChart";
import AIInsightCard from "../components/AIInsightCard";
import CsvImportDialog from "../components/CsvImportDialog";
import { useAuth } from "../contexts/AuthContext";
import { ChevronLeft, FileWarning, AlertTriangle, FileText, Receipt, FolderTree, CalendarRange, BarChart3, Layers, Upload } from "lucide-react";
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [wbs, setWbs] = useState([]);
  const [gantt, setGantt] = useState([]);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const loadWbs = () => api.get(`/wbs?project_id=${id}`).then((r) => setWbs(r.data));

  useEffect(() => {
    api.get(`/projects/${id}/overview`).then((r) => setData(r.data));
    loadWbs();
    api.get(`/projects/${id}/gantt`).then((r) => setGantt(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEditWbs = user && ["admin", "ProjectCoordinator"].includes(user.role);

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
        <KpiCard testId="proj-kpi-packages" label="Packages" value={packages.length} accent="blue" icon={Layers} />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none p-0 h-auto">
          {[
            { v: "overview", l: "Overview", i: BarChart3 },
            { v: "wbs", l: "WBS Tree", i: FolderTree },
            { v: "gantt", l: "Gantt Timeline", i: CalendarRange },
            { v: "packages", l: "Packages", i: Layers },
            { v: "milestones", l: "Milestones", i: AlertTriangle },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              data-testid={`tab-${t.v}`}
              className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 -mb-px"
            >
              <t.i className="w-3.5 h-3.5 mr-1.5" /> {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          <AIInsightCard projectId={id} />

          <div className="card-flat p-5">
            <div className="text-overline">Progress S-Curve</div>
            <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Planned vs Actual Cumulative (24 weeks)</h3>
            <ResponsiveContainer width="100%" height={300}>
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
        </TabsContent>

        {/* WBS */}
        <TabsContent value="wbs" className="mt-5">
          <div className="card-flat p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div>
                <div className="text-overline">Work Breakdown Structure</div>
                <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">Multi-level hierarchy ({wbs.length} elements)</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-slate-500 font-mono">
                  Levels: {[...new Set(wbs.map((w) => w.level))].sort().join(" · ")}
                </div>
                {canEditWbs && (
                  <button
                    data-testid="wbs-import-csv-button"
                    onClick={() => setShowCsvImport(true)}
                    className="text-xs font-semibold px-3 py-1.5 border border-slate-300 hover:border-blue-600 hover:text-blue-700 rounded-sm inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Import CSV
                  </button>
                )}
              </div>
            </div>
            <WbsTree items={wbs} projectId={id} editable={canEditWbs} onChange={loadWbs} />
          </div>
          <CsvImportDialog
            open={showCsvImport}
            onClose={() => setShowCsvImport(false)}
            projectId={id}
            onImported={() => loadWbs()}
          />
        </TabsContent>

        {/* Gantt */}
        <TabsContent value="gantt" className="mt-5">
          <div className="card-flat p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-overline">Schedule Timeline</div>
                <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5">Activity Gantt — {gantt.length} activities</h3>
              </div>
            </div>
            <GanttChart activities={gantt} />
          </div>
        </TabsContent>

        {/* Packages */}
        <TabsContent value="packages" className="mt-5">
          <div className="card-flat p-5">
            <div className="text-overline">Work Packages</div>
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
        </TabsContent>

        {/* Milestones */}
        <TabsContent value="milestones" className="mt-5">
          <div className="card-flat p-5">
            <div className="text-overline">Contractual Milestones</div>
            <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Key dates and commitments</h3>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
