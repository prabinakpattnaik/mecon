import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Check, Plus } from "lucide-react";
import CreateNCRDialog from "../components/CreateNCRDialog";

export default function Quality() {
  const [ncrs, setNcrs] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    api.get(`/ncrs${q}`).then((r) => setNcrs(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const close = async (id) => {
    await api.post(`/ncrs/${id}/close`).catch(() => {});
    load();
  };

  const stats = {
    total: ncrs.length,
    open: ncrs.filter((n) => n.status === "Open").length,
    critical: ncrs.filter((n) => n.severity === "Critical" && n.status === "Open").length,
    closed: ncrs.filter((n) => n.status === "Closed").length,
  };

  return (
    <div className="space-y-5" data-testid="quality-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-overline">Quality Assurance</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Quality & NCR Management</h1>
          <p className="text-sm text-slate-600 mt-1">Non-conformance reports, observations and corrective actions.</p>
        </div>
        <button
          data-testid="ncr-create-button"
          onClick={() => setShowCreate(true)}
          className="text-sm font-semibold px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Raise NCR
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Total NCRs", v: stats.total, c: "text-slate-900" },
          { l: "Open", v: stats.open, c: "text-amber-700" },
          { l: "Critical (Open)", v: stats.critical, c: "text-red-700" },
          { l: "Closed", v: stats.closed, c: "text-emerald-700" },
        ].map((s) => (
          <div key={s.l} className="card-flat p-4">
            <div className="text-overline">{s.l}</div>
            <div className={`kpi-value ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-sm p-0.5 w-fit">
        {["", "Open", "Closed"].map((f) => (
          <button
            key={f || "all"}
            data-testid={`ncr-filter-${(f || "all").toLowerCase()}`}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-sm font-semibold ${
              filter === f ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >{f || "All"}</button>
        ))}
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-overline text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">NCR #</th>
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-left px-4 py-2.5">Responsible</th>
              <th className="text-left px-4 py-2.5">Severity</th>
              <th className="text-left px-4 py-2.5">Target Closure</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {ncrs.map((n) => (
              <tr key={n.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`ncr-row-${n.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{n.ncr_number}</td>
                <td className="px-4 py-2.5 text-slate-900 max-w-md">{n.description}</td>
                <td className="px-4 py-2.5 text-slate-700 text-xs">{n.responsible}</td>
                <td className="px-4 py-2.5"><StatusBadge value={n.severity} /></td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{n.target_closure}</td>
                <td className="px-4 py-2.5"><StatusBadge value={n.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  {n.status === "Open" && (
                    <button data-testid={`ncr-close-${n.id}`} onClick={() => close(n.id)} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm hover:bg-emerald-100 font-semibold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateNCRDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load()} />
    </div>
  );
}
