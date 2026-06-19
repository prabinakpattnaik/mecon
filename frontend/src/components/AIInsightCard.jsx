import React, { useEffect, useState } from "react";
import api from "../api/client";
import { Sparkles, RefreshCw, AlertOctagon, Target, TrendingUp } from "lucide-react";
import StatusBadge from "./StatusBadge";

export default function AIInsightCard({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = (force = false) => {
    if (force) setRefreshing(true);
    api
      .get(`/projects/${projectId}/ai-insights${force ? "?force=true" : ""}`)
      .then((r) => setData(r.data))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    if (projectId) load(false);
  }, [projectId]);

  return (
    <div className="card-flat p-5 relative" data-testid="ai-insight-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 border border-blue-200 rounded-sm flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <div className="text-overline text-blue-700">AI Risk & Health Engine</div>
            <h3 className="font-display text-lg font-semibold text-slate-900 tracking-tight">Claude Sonnet 4.6 · Project Insights</h3>
          </div>
        </div>
        <button
          data-testid="ai-insight-refresh"
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-xs px-2.5 py-1.5 border border-slate-300 hover:border-blue-600 hover:text-blue-700 rounded-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      {loading && (
        <div className="mt-6 text-overline text-slate-500" data-testid="ai-insight-loading">
          Generating AI insights from current project state…
        </div>
      )}

      {data && !loading && (
        <div className="mt-4 space-y-4">
          <div className="bg-slate-50 border-l-2 border-blue-600 px-3 py-2 rounded-sm" data-testid="ai-health-summary">
            <div className="text-overline mb-1">Health Summary</div>
            <p className="text-[13px] text-slate-800 leading-relaxed">{data.health_summary}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                <div className="text-overline">Top Risks</div>
              </div>
              <ol className="space-y-2">
                {(data.top_risks || []).map((r, i) => (
                  <li key={i} className="border border-slate-200 rounded-sm p-2.5" data-testid={`ai-risk-${i}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-[13px] text-slate-900">{r.title}</div>
                      <StatusBadge value={r.impact} />
                    </div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">{r.why}</div>
                  </li>
                ))}
                {(!data.top_risks || data.top_risks.length === 0) && (
                  <li className="text-xs text-slate-500 italic">No risks flagged</li>
                )}
              </ol>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-700" />
                <div className="text-overline">Recommended Actions</div>
              </div>
              <ol className="space-y-2">
                {(data.recommendations || []).map((r, i) => (
                  <li key={i} className="border border-slate-200 rounded-sm p-2.5" data-testid={`ai-rec-${i}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-[13px] text-slate-900">{r.action}</div>
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-sm border ${
                        r.priority === "P0" ? "bg-red-50 text-red-700 border-red-200" :
                        r.priority === "P1" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-50 text-slate-700 border-slate-200"
                      }`}>{r.priority}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Owner: <span className="font-medium">{r.owner}</span></div>
                  </li>
                ))}
                {(!data.recommendations || data.recommendations.length === 0) && (
                  <li className="text-xs text-slate-500 italic">No recommendations</li>
                )}
              </ol>
            </div>
          </div>

          {data.forecast && (
            <div className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-sm flex items-start gap-2" data-testid="ai-forecast">
              <TrendingUp className="w-3.5 h-3.5 text-blue-700 mt-0.5 flex-shrink-0" />
              <div className="text-[13px] text-blue-900"><span className="text-overline text-blue-700">Forecast: </span>{data.forecast}</div>
            </div>
          )}

          <div className="text-[10px] text-slate-400 font-mono pt-1">
            Generated {data.created_at ? new Date(data.created_at).toLocaleString("en-IN") : "now"} · Cached for 30 min
          </div>
        </div>
      )}
    </div>
  );
}
