import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { Link } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/projects").then((r) => setProjects(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5" data-testid="projects-root">
      <div>
        <div className="text-overline">Portfolio</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Projects</h1>
        <p className="text-sm text-slate-600 mt-1">All active mega-projects under MECON monitoring.</p>
      </div>

      {loading && <div className="text-overline text-slate-500">Loading…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            data-testid={`project-card-${p.code}`}
            className="card-flat p-5 hover:border-blue-600 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-slate-500">{p.code}</div>
                  <h3 className="font-display text-base font-semibold text-slate-900 tracking-tight leading-snug">{p.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{p.client} · {p.location}</div>
                </div>
              </div>
              <StatusBadge value={p.health} />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
              <div>
                <div className="text-overline">Planned</div>
                <div className="font-display text-xl font-bold text-slate-900 mt-0.5">{p.planned_progress}%</div>
              </div>
              <div>
                <div className="text-overline">Actual</div>
                <div className={`font-display text-xl font-bold mt-0.5 ${p.actual_progress < p.planned_progress ? "text-red-700" : "text-emerald-700"}`}>
                  {p.actual_progress}%
                </div>
              </div>
              <div>
                <div className="text-overline">Value</div>
                <div className="font-display text-xl font-bold text-slate-900 mt-0.5">₹{p.value_cr}<span className="text-xs text-slate-500 ml-1 font-normal font-sans">Cr</span></div>
              </div>
            </div>

            <div className="mt-4 h-2 bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={`h-full ${p.actual_progress < p.planned_progress ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${Math.min(100, p.actual_progress)}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>{p.start_date} → {p.end_date}</span>
              <span className="text-blue-700 font-semibold opacity-0 group-hover:opacity-100 flex items-center gap-1">
                Open <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
