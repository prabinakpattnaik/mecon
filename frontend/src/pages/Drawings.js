import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Check, X, FileText } from "lucide-react";

export default function Drawings() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    api.get(`/drawings${q}`).then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const action = async (id, type) => {
    await api.post(`/drawings/${id}/${type}`);
    load();
  };

  const stats = {
    total: items.length,
    submitted: items.filter((i) => i.status === "Submitted").length,
    approved: items.filter((i) => i.status === "Approved").length,
    rejected: items.filter((i) => i.status === "Rejected").length,
  };

  return (
    <div className="space-y-5" data-testid="drawings-root">
      <div>
        <div className="text-overline">Engineering</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Drawing & Document Approval</h1>
        <p className="text-sm text-slate-600 mt-1">Centralised drawing register with revision and approval tracking.</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Total", v: stats.total, c: "text-slate-900" },
          { l: "Pending Approval", v: stats.submitted, c: "text-sky-700" },
          { l: "Approved", v: stats.approved, c: "text-emerald-700" },
          { l: "Rejected", v: stats.rejected, c: "text-red-700" },
        ].map((s) => (
          <div key={s.l} className="card-flat p-4">
            <div className="text-overline">{s.l}</div>
            <div className={`kpi-value ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white border border-slate-200 rounded-sm p-0.5 w-fit">
        {["", "Submitted", "Approved", "Rejected"].map((f) => (
          <button
            key={f || "all"}
            data-testid={`dwg-filter-${(f || "all").toLowerCase()}`}
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
              <th className="text-left px-4 py-2.5">Drawing #</th>
              <th className="text-left px-4 py-2.5">Title</th>
              <th className="text-left px-4 py-2.5">Discipline</th>
              <th className="text-left px-4 py-2.5">Originator</th>
              <th className="text-center px-4 py-2.5">Rev</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {items.map((d) => (
              <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`dwg-row-${d.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{d.drawing_number}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-900 font-medium">{d.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{d.discipline}</td>
                <td className="px-4 py-2.5 text-slate-700">{d.originator}</td>
                <td className="px-4 py-2.5 text-center font-mono text-xs">{d.revision}</td>
                <td className="px-4 py-2.5"><StatusBadge value={d.status} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {d.status === "Submitted" && (
                      <>
                        <button data-testid={`dwg-approve-${d.id}`} onClick={() => action(d.id, "approve")} className="p-1.5 hover:bg-emerald-50 text-emerald-700 border border-transparent hover:border-emerald-200 rounded-sm"><Check className="w-3.5 h-3.5" /></button>
                        <button data-testid={`dwg-reject-${d.id}`} onClick={() => action(d.id, "reject")} className="p-1.5 hover:bg-red-50 text-red-700 border border-transparent hover:border-red-200 rounded-sm"><X className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No drawings</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
