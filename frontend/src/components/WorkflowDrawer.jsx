import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import StatusBadge from "./StatusBadge";
import api from "../api/client";
import { Check, X, FastForward, MessageSquare, History, Send } from "lucide-react";

export default function WorkflowDrawer({ workflowId, onClose, onChanged }) {
  const [wf, setWf] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setWf(null);
      return;
    }
    api.get(`/workflows/${workflowId}`).then((r) => setWf(r.data));
  }, [workflowId]);

  const act = async (action) => {
    setBusy(true);
    try {
      await api.post(`/workflows/${workflowId}/action`, { action, comment });
      const r = await api.get(`/workflows/${workflowId}`);
      setWf(r.data);
      setComment("");
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const open = Boolean(workflowId);
  const isFinal = wf && ["Approved", "Rejected", "Closed"].includes(wf.status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose?.()}>
      <SheetContent className="w-full sm:max-w-lg p-0 overflow-y-auto" data-testid="workflow-drawer">
        {!wf && (
          <div className="p-6 text-overline text-slate-500">Loading workflow…</div>
        )}
        {wf && (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">{wf.type} workflow</span>
                <StatusBadge value={wf.status} testId="wf-drawer-status" />
              </div>
              <SheetTitle className="font-display text-lg tracking-tight">{wf.title}</SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                Raised by {wf.raised_by} · {new Date(wf.raised_at).toLocaleString("en-IN")}
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="card-flat p-3">
                  <div className="text-overline">Priority</div>
                  <div className="mt-1"><StatusBadge value={wf.priority} /></div>
                </div>
                <div className="card-flat p-3">
                  <div className="text-overline">SLA</div>
                  <div className="font-display text-lg font-bold text-slate-900 mt-0.5">{wf.sla_hours}h</div>
                </div>
                <div className="card-flat p-3 col-span-2">
                  <div className="text-overline">Current Stage</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">{wf.current_stage}</div>
                </div>
              </div>

              {/* History */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <div className="text-overline">Approval History</div>
                </div>
                {(!wf.history || wf.history.length === 0) ? (
                  <div className="text-xs text-slate-500 italic">No actions taken yet.</div>
                ) : (
                  <ol className="border-l-2 border-slate-200 ml-2 space-y-3">
                    {wf.history.map((h, i) => (
                      <li key={i} className="relative pl-4" data-testid={`wf-history-${i}`}>
                        <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                          h.action === "approve" ? "bg-emerald-600" :
                          h.action === "reject" ? "bg-red-600" :
                          h.action === "escalate" ? "bg-amber-500" : "bg-slate-400"
                        }`}></span>
                        <div className="text-[13px] font-medium text-slate-900 capitalize">{h.action}</div>
                        <div className="text-xs text-slate-500">{h.by} <span className="text-slate-400">({h.role})</span> · {new Date(h.at).toLocaleString("en-IN")}</div>
                        {h.comment && (
                          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 mt-1 inline-block">
                            {h.comment}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Action panel */}
              {!isFinal && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-overline">Action</div>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    data-testid="wf-drawer-comment"
                    placeholder="Add a comment for this action (optional)…"
                    rows={3}
                    className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      data-testid="wf-drawer-approve"
                      disabled={busy}
                      onClick={() => act("approve")}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-sm"
                    ><Check className="w-3.5 h-3.5" /> Approve</button>
                    <button
                      data-testid="wf-drawer-reject"
                      disabled={busy}
                      onClick={() => act("reject")}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-sm"
                    ><X className="w-3.5 h-3.5" /> Reject</button>
                    <button
                      data-testid="wf-drawer-escalate"
                      disabled={busy}
                      onClick={() => act("escalate")}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-sm"
                    ><FastForward className="w-3.5 h-3.5" /> Escalate</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
