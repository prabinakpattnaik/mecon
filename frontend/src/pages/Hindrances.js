import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Check, Plus } from "lucide-react";
import CreateHindranceDialog from "../components/CreateHindranceDialog";

export default function Hindrances() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    api.get(`/hindrances${q}`).then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const close = async (id) => {
    await api.post(`/hindrances/${id}/close`).catch(() => {});
    load();
  };

  const stats = {
    open: items.filter((i) => i.status === "Open").length,
    critical: items.filter((i) => i.severity === "Critical" && i.status === "Open").length,
    closed: items.filter((i) => i.status === "Closed").length,
  };

  return (
    <div className="space-y-5" data-testid="hindrances-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-overline">Field Constraints</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Hindrance Management</h1>
          <p className="text-sm text-slate-600 mt-1">Track execution hindrances, resolution aging and responsibility.</p>
        </div>
        <button
          data-testid="hnd-create-button"
          onClick={() => setShowCreate(true)}
          className="text-sm font-semibold px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Register Hindrance
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card-flat p-4"><div className="text-overline">Open Hindrances</div><div className="kpi-value text-amber-700">{stats.open}</div></div>
        <div className="card-flat p-4"><div className="text-overline">Critical Open</div><div className="kpi-value text-red-700">{stats.critical}</div></div>
        <div className="card-flat p-4"><div className="text-overline">Resolved</div><div className="kpi-value text-emerald-700">{stats.closed}</div></div>
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-sm p-0.5 w-fit">
        {["", "Open", "Closed"].map((f) => (
          <button
            key={f || "all"}
            data-testid={`hnd-filter-${(f || "all").toLowerCase()}`}
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
              <th className="text-left px-4 py-2.5">HND #</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-left px-4 py-2.5">Responsible</th>
              <th className="text-left px-4 py-2.5">Severity</th>
              <th className="text-left px-4 py-2.5">Target Closure</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {items.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`hnd-row-${h.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{h.hindrance_number}</td>
                <td className="px-4 py-2.5 text-slate-700 text-xs">{h.type}</td>
                <td className="px-4 py-2.5 text-slate-900 max-w-sm truncate">{h.description}</td>
                <td className="px-4 py-2.5 text-slate-700 text-xs">{h.responsible}</td>
                <td className="px-4 py-2.5"><StatusBadge value={h.severity} /></td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{h.target_closure}</td>
                <td className="px-4 py-2.5"><StatusBadge value={h.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  {h.status === "Open" && (
                    <button data-testid={`hnd-close-${h.id}`} onClick={() => close(h.id)} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm hover:bg-emerald-100 font-semibold inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateHindranceDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => load()} />
    </div>
  );
}
