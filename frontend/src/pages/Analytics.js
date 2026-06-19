import React, { useEffect, useState } from "react";
import api from "../api/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [ncrs, setNcrs] = useState([]);
  const [hindrances, setHindrances] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/summary"),
      api.get("/ncrs"),
      api.get("/hindrances"),
    ]).then(([s, n, h]) => {
      setData(s.data);
      setNcrs(n.data);
      setHindrances(h.data);
    });
  }, []);

  if (!data) return <div className="text-overline text-slate-500">Loading analytics…</div>;

  const ncrBySev = ["Critical", "High", "Medium", "Low"].map((s) => ({
    name: s,
    value: ncrs.filter((n) => n.severity === s).length,
  }));
  const hindBySev = ["Critical", "High", "Medium", "Low"].map((s) => ({
    name: s,
    value: hindrances.filter((h) => h.severity === s).length,
  }));

  const COLORS = ["#dc2626", "#d97706", "#0284c7", "#64748b"];

  return (
    <div className="space-y-5" data-testid="analytics-root">
      <div>
        <div className="text-overline">Insights</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Performance Analytics</h1>
        <p className="text-sm text-slate-600 mt-1">Portfolio-wide KPIs, trends and AI-assisted contractor ratings.</p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="card-flat col-span-12 lg:col-span-8 p-5">
          <div className="text-overline">Portfolio Health</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Planned vs Actual % across active projects</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.portfolio_progress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="%" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="planned" fill="#94a3b8" name="Planned" />
              <Bar dataKey="actual" fill="#1d4ed8" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat col-span-12 lg:col-span-4 p-5">
          <div className="text-overline">Contractor Ranking</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">By avg progress</h3>
          <div className="space-y-1.5">
            {data.contractor_performance.map((c, i) => (
              <div key={c.contractor} className="flex items-center justify-between border-b border-slate-100 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-xs text-slate-500 w-4">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{c.contractor}</div>
                    <div className="text-[11px] text-slate-500">{c.avg_progress}% · {c.packages} pkg</div>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded-sm text-xs font-bold font-mono border ${
                  c.grade === "A+" || c.grade === "A" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  c.grade === "B" ? "bg-sky-50 text-sky-700 border-sky-200" :
                  c.grade === "C" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-700 border-red-200"
                }`}>{c.grade}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-flat col-span-12 md:col-span-6 p-5">
          <div className="text-overline">NCRs by Severity</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Quality risk distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={ncrBySev} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {ncrBySev.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card-flat col-span-12 md:col-span-6 p-5">
          <div className="text-overline">Hindrances by Severity</div>
          <h3 className="font-display text-lg font-semibold text-slate-900 mt-0.5 mb-3">Execution risk distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hindBySev}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 2 }} />
              <Bar dataKey="value" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
