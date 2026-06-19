import React from "react";

export default function KpiCard({ label, value, unit, delta, accent = "blue", icon: Icon, testId }) {
  const accents = {
    blue: "text-blue-700",
    red: "text-red-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };
  return (
    <div data-testid={testId} className="card-flat p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="text-overline">{label}</div>
        {Icon && <Icon className={`w-4 h-4 ${accents[accent]}`} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`kpi-value ${accents[accent]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-500 font-medium">{unit}</span>}
      </div>
      {delta && <div className="text-xs text-slate-500 mt-1">{delta}</div>}
    </div>
  );
}
