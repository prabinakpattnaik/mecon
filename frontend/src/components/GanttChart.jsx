import React, { useMemo } from "react";
import { CalendarRange } from "lucide-react";

function parseISO(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function monthBuckets(start, end) {
  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export default function GanttChart({ activities = [] }) {
  const data = useMemo(() => {
    const items = activities
      .map((a) => ({
        ...a,
        ps: parseISO(a.planned_start),
        pe: parseISO(a.planned_end),
        as: parseISO(a.actual_start),
        ae: parseISO(a.actual_end),
      }))
      .filter((a) => a.ps && a.pe);
    if (!items.length) return null;
    const starts = items.map((a) => a.ps.getTime());
    const ends = items.map((a) => a.pe.getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    const total = Math.max(1, daysBetween(min, max));
    const months = monthBuckets(min, max);
    return { items, min, max, total, months };
  }, [activities]);

  if (!data) {
    return (
      <div className="text-center text-slate-500 text-sm py-8 border border-dashed border-slate-200 rounded-sm">
        <CalendarRange className="w-6 h-6 mx-auto text-slate-300 mb-2" />
        No scheduled activities to display.
      </div>
    );
  }

  const { items, min, total, months } = data;
  const ROW_H = 28;

  // Group by area
  const grouped = {};
  items.forEach((a) => {
    if (!grouped[a.area]) grouped[a.area] = [];
    grouped[a.area].push(a);
  });

  return (
    <div className="border border-slate-200 rounded-sm overflow-hidden bg-white" data-testid="gantt-chart">
      <div className="grid" style={{ gridTemplateColumns: "260px 1fr" }}>
        {/* Left labels */}
        <div className="border-r border-slate-200">
          <div className="h-10 bg-slate-50 border-b border-slate-200 px-3 flex items-center text-overline">
            Activity
          </div>
          {Object.entries(grouped).map(([area, acts]) => (
            <div key={area}>
              <div className="h-7 bg-slate-100 border-b border-slate-200 px-3 flex items-center text-[10px] uppercase tracking-widest font-semibold text-slate-600">
                {area}
              </div>
              {acts.map((a) => (
                <div
                  key={a.id}
                  className="border-b border-slate-100 px-3 flex items-center text-xs"
                  style={{ height: ROW_H }}
                >
                  <div className="truncate font-medium text-slate-900">{a.name}</div>
                  {a.is_critical && (
                    <span className="ml-1.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1 rounded-sm">CRIT</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right timeline */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Month header */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex relative">
              {months.map((m, i) => {
                const next = months[i + 1] || data.max;
                const left = (daysBetween(min, m) / total) * 100;
                const width = (daysBetween(m, next) / total) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-slate-200 text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-1.5 flex items-center"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {m.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                  </div>
                );
              })}
            </div>
            {/* Body */}
            {Object.entries(grouped).map(([area, acts]) => (
              <div key={area}>
                <div className="h-7 bg-slate-100 border-b border-slate-200"></div>
                {acts.map((a) => {
                  const left = (daysBetween(min, a.ps) / total) * 100;
                  const width = Math.max(0.5, (daysBetween(a.ps, a.pe) / total) * 100);
                  const actLeft = a.as ? (daysBetween(min, a.as) / total) * 100 : null;
                  const actEnd = a.ae || (a.progress > 0 ? new Date() : null);
                  const actWidth = actLeft != null && actEnd ? Math.max(0.5, (daysBetween(a.as, actEnd) / total) * 100) : 0;
                  return (
                    <div
                      key={a.id}
                      className="border-b border-slate-100 relative"
                      style={{ height: ROW_H }}
                      data-testid={`gantt-bar-${a.id}`}
                    >
                      {/* Planned bar */}
                      <div
                        className="absolute top-1.5 h-2.5 bg-slate-300 rounded-sm"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`Planned ${a.planned_start} → ${a.planned_end}`}
                      ></div>
                      {/* Actual bar */}
                      {actLeft != null && actWidth > 0 && (
                        <div
                          className={`absolute top-[15px] h-2.5 rounded-sm ${
                            a.is_critical ? "bg-red-600" : a.progress >= 100 ? "bg-emerald-600" : "bg-blue-700"
                          }`}
                          style={{ left: `${actLeft}%`, width: `${actWidth}%` }}
                          title={`Actual: ${a.progress}% complete`}
                        ></div>
                      )}
                      {/* Progress label */}
                      <div
                        className="absolute top-0 text-[9px] font-mono text-slate-600 px-1"
                        style={{ left: `calc(${left + width}% + 4px)`, lineHeight: `${ROW_H}px` }}
                      >
                        {a.progress}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-3 py-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-slate-300 rounded-sm"></span> Planned</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-700 rounded-sm"></span> Actual</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-600 rounded-sm"></span> Completed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-600 rounded-sm"></span> Critical path</span>
      </div>
    </div>
  );
}
