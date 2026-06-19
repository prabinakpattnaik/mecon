import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";

const refMap = {
  workflows: "/workflows",
  drawings: "/drawings",
  ncrs: "/quality",
  hindrances: "/hindrances",
  bills: "/finance",
};

export default function MyActions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/my-actions").then((r) => setItems(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5" data-testid="my-actions-root">
      <div>
        <div className="text-overline">Personalised Worklist</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">My Actions</h1>
        <p className="text-sm text-slate-600 mt-1">All pending approvals, NCRs, drawings & workflows assigned to you.</p>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-overline text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Item</th>
              <th className="text-left px-4 py-2.5">Priority</th>
              <th className="text-left px-4 py-2.5">Due / Raised</th>
              <th className="text-right px-4 py-2.5">Open</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {items.map((a) => (
              <tr key={a.id + a.ref} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`action-row-${a.id}`}>
                <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700">{a.type}</td>
                <td className="px-4 py-2.5 text-slate-900 max-w-xl truncate">{a.title}</td>
                <td className="px-4 py-2.5"><StatusBadge value={a.priority} /></td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{a.due ? new Date(a.due).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link to={refMap[a.ref] || "/"} className="text-xs text-blue-700 font-semibold hover:underline" data-testid={`action-open-${a.id}`}>Open →</Link>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="p-10 text-center text-slate-500">Nothing assigned &mdash; you&apos;re all caught up.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
