import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Clock, MinusCircle } from "lucide-react";

const map = {
  green: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "On Track" },
  amber: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "At Risk" },
  red: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle, label: "Critical" },
  Open: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  Closed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Submitted: { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: Clock },
  "Under Review": { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: Clock },
  Approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Rejected: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  Pending: { cls: "bg-slate-50 text-slate-700 border-slate-200", icon: Clock },
  "In Progress": { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: Clock },
  Escalated: { cls: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  Paid: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Critical: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  High: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle },
  Medium: { cls: "bg-sky-50 text-sky-700 border-sky-200", icon: MinusCircle },
  Low: { cls: "bg-slate-50 text-slate-600 border-slate-200", icon: MinusCircle },
  Completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  Delayed: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  Upcoming: { cls: "bg-slate-50 text-slate-700 border-slate-200", icon: Clock },
  Verified: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

export default function StatusBadge({ value, label, testId }) {
  const cfg = map[value] || { cls: "bg-slate-50 text-slate-700 border-slate-200", icon: MinusCircle };
  const Icon = cfg.icon;
  const text = label || cfg.label || value || "—";
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border rounded-sm ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}
