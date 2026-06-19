import React, { useEffect, useState } from "react";
import api from "../api/client";
import { ScrollText, Filter, User } from "lucide-react";

const ACTION_COLOR = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-200",
  update: "bg-sky-50 text-sky-700 border-sky-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  approve: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reject: "bg-red-50 text-red-700 border-red-200",
  escalate: "bg-amber-50 text-amber-700 border-amber-200",
  close: "bg-emerald-50 text-emerald-700 border-emerald-200",
  import: "bg-sky-50 text-sky-700 border-sky-200",
};

const ENTITY_TYPES = ["", "project", "ncr", "hindrance", "workflow", "wbs", "workflow_template"];

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  const load = () => {
    setLoading(true);
    const q = entityFilter ? `?entity_type=${entityFilter}` : "";
    api.get(`/audit-logs${q}`).then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, [entityFilter]);

  const verbBadge = (action) => {
    const verb = action.split(".").pop() || action;
    const cls = ACTION_COLOR[verb] || "bg-slate-50 text-slate-700 border-slate-200";
    return (
      <span className={`text-[10px] uppercase tracking-wide font-bold font-mono px-1.5 py-0.5 border rounded-sm ${cls}`}>
        {verb}
      </span>
    );
  };

  return (
    <div className="space-y-5" data-testid="audit-log-root">
      <div>
        <div className="text-overline">Compliance & Traceability</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Audit Log Explorer</h1>
        <p className="text-sm text-slate-600 mt-1">Immutable, time-stamped record of every mutating action across the platform.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-500" />
        <div className="flex gap-1 bg-white border border-slate-200 rounded-sm p-0.5">
          {ENTITY_TYPES.map((e) => (
            <button
              key={e || "all"}
              data-testid={`audit-filter-${e || "all"}`}
              onClick={() => setEntityFilter(e)}
              className={`text-xs px-3 py-1.5 rounded-sm font-semibold ${
                entityFilter === e ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >{e || "All"}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500 font-mono">{items.length} events</span>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-overline text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Timestamp</th>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-left px-4 py-2.5">Action</th>
              <th className="text-left px-4 py-2.5">Entity</th>
              <th className="text-left px-4 py-2.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-slate-500">
                <ScrollText className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                No audit events for this filter.
              </td></tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`audit-row-${a.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="font-medium text-slate-900 text-[13px]">{a.user_name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{a.user_role}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{verbBadge(a.action)}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{a.entity_type}</td>
                <td className="px-4 py-2.5 text-slate-700 max-w-xl truncate">{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
