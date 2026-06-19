import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Users, Truck, Check } from "lucide-react";

export default function DPR() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/dpr").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const verify = async (id) => {
    await api.post(`/dpr/${id}/verify`).catch(() => {});
    load();
  };

  return (
    <div className="space-y-5" data-testid="dpr-root">
      <div>
        <div className="text-overline">Field Operations</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Daily Progress Reports</h1>
        <p className="text-sm text-slate-600 mt-1">Daily DPR submissions from contractors with planned/actual variance.</p>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-overline text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Activities</th>
              <th className="text-right px-4 py-2.5">Planned %</th>
              <th className="text-right px-4 py-2.5">Actual %</th>
              <th className="text-right px-4 py-2.5">Variance</th>
              <th className="text-right px-4 py-2.5">Manpower</th>
              <th className="text-right px-4 py-2.5">Equip.</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {items.slice(0, 50).map((d) => (
              <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`dpr-row-${d.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{d.date}</td>
                <td className="px-4 py-2.5 text-slate-700 max-w-md truncate">{d.activities}</td>
                <td className="px-4 py-2.5 text-right font-mono">{d.planned_pct}</td>
                <td className="px-4 py-2.5 text-right font-mono">{d.actual_pct}</td>
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${d.variance < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {d.variance > 0 ? "+" : ""}{d.variance}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-700"><Users className="w-3 h-3 inline mr-1 text-slate-400" />{d.manpower}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-700"><Truck className="w-3 h-3 inline mr-1 text-slate-400" />{d.equipment}</td>
                <td className="px-4 py-2.5"><StatusBadge value={d.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  {d.status === "Submitted" && (
                    <button data-testid={`dpr-verify-${d.id}`} onClick={() => verify(d.id)} className="p-1.5 hover:bg-emerald-50 text-emerald-700 border border-transparent hover:border-emerald-200 rounded-sm"><Check className="w-3.5 h-3.5" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
