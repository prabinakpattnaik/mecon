import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { ArrowUpRight, Check, X, FastForward } from "lucide-react";

export default function Workflows() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    api.get(`/workflows${q}`).then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const act = async (wid, action) => {
    await api.post(`/workflows/${wid}/action`, { action, comment: `${action} by user` });
    load();
  };

  const filters = ["", "Pending", "In Progress", "Escalated", "Approved", "Rejected"];

  return (
    <div className="space-y-5" data-testid="workflows-root">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-overline">Governance</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Workflows & Approvals</h1>
          <p className="text-sm text-slate-600 mt-1">Centralised routing across all approval workflows.</p>
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-sm p-0.5">
          {filters.map((f) => (
            <button
              key={f || "all"}
              data-testid={`wf-filter-${f.toLowerCase().replace(/\s/g, "-") || "all"}`}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-sm font-semibold transition-colors ${
                filter === f ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >{f || "All"}</button>
          ))}
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-overline text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Workflow</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Current Stage</th>
              <th className="text-left px-4 py-2.5">Priority</th>
              <th className="text-left px-4 py-2.5">SLA</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && items.map((w) => (
              <tr key={w.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`wf-row-${w.id}`}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-900 text-[13px]">{w.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">by {w.raised_by} · {new Date(w.raised_at).toLocaleDateString("en-IN")}</div>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono uppercase text-slate-600">{w.type}</td>
                <td className="px-4 py-2.5 text-slate-700">{w.current_stage}</td>
                <td className="px-4 py-2.5"><StatusBadge value={w.priority} /></td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{w.sla_hours}h</td>
                <td className="px-4 py-2.5"><StatusBadge value={w.status} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {["Pending", "In Progress", "Escalated"].includes(w.status) ? (
                      <>
                        <button
                          data-testid={`wf-approve-${w.id}`}
                          onClick={() => act(w.id, "approve")}
                          className="p-1.5 hover:bg-emerald-50 text-emerald-700 border border-transparent hover:border-emerald-200 rounded-sm"
                          title="Approve"
                        ><Check className="w-3.5 h-3.5" /></button>
                        <button
                          data-testid={`wf-reject-${w.id}`}
                          onClick={() => act(w.id, "reject")}
                          className="p-1.5 hover:bg-red-50 text-red-700 border border-transparent hover:border-red-200 rounded-sm"
                          title="Reject"
                        ><X className="w-3.5 h-3.5" /></button>
                        <button
                          data-testid={`wf-escalate-${w.id}`}
                          onClick={() => act(w.id, "escalate")}
                          className="p-1.5 hover:bg-amber-50 text-amber-700 border border-transparent hover:border-amber-200 rounded-sm"
                          title="Escalate"
                        ><FastForward className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">closed</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No workflows match this filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
