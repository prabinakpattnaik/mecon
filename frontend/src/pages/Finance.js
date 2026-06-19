import React, { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { ArrowRight, IndianRupee } from "lucide-react";

const STAGES = ["Submitted", "Measurement", "Site Verification", "Coordinator Review", "Finance Review", "SAP Processing", "Paid"];

export default function Finance() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/bills").then((r) => setBills(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const advance = async (id) => {
    await api.post(`/bills/${id}/advance`).catch(() => {});
    load();
  };

  const byStage = {};
  STAGES.forEach((s) => (byStage[s] = []));
  bills.forEach((b) => {
    if (byStage[b.current_stage]) byStage[b.current_stage].push(b);
  });

  const totalBilled = bills.reduce((s, b) => s + (b.value_lakh || 0), 0);
  const paid = bills.filter((b) => b.status === "Paid").reduce((s, b) => s + b.value_lakh, 0);
  const outstanding = totalBilled - paid;
  const inPipeline = bills.filter((b) => b.status !== "Paid").length;

  return (
    <div className="space-y-5" data-testid="finance-root">
      <div>
        <div className="text-overline">Financial Governance</div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Finance & Billing</h1>
        <p className="text-sm text-slate-600 mt-1">Contractor bill lifecycle Kanban — submission → SAP payment. Monitor only (SAP processes payments).</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card-flat p-4">
          <div className="text-overline">Total Billed</div>
          <div className="kpi-value text-slate-900">₹{(totalBilled / 100).toFixed(1)}<span className="text-sm text-slate-500 ml-1 font-normal font-sans">Cr</span></div>
        </div>
        <div className="card-flat p-4">
          <div className="text-overline">Paid (Released)</div>
          <div className="kpi-value text-emerald-700">₹{(paid / 100).toFixed(1)}<span className="text-sm text-slate-500 ml-1 font-normal font-sans">Cr</span></div>
        </div>
        <div className="card-flat p-4">
          <div className="text-overline">Outstanding</div>
          <div className="kpi-value text-amber-700">₹{(outstanding / 100).toFixed(1)}<span className="text-sm text-slate-500 ml-1 font-normal font-sans">Cr</span></div>
        </div>
        <div className="card-flat p-4">
          <div className="text-overline">In Pipeline</div>
          <div className="kpi-value text-blue-700">{inPipeline}</div>
        </div>
      </div>

      <div>
        <div className="text-overline mb-2">Bill Lifecycle Kanban</div>
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-2">
            {STAGES.map((s) => (
              <div key={s} className="w-72 flex-shrink-0" data-testid={`finance-stage-${s.toLowerCase().replace(/\s/g, "-")}`}>
                <div className={`text-overline px-3 py-2 border-b-2 ${s === "Paid" ? "border-emerald-600 text-emerald-700" : "border-slate-300 text-slate-700"}`}>
                  {s} <span className="float-right font-mono">{byStage[s]?.length || 0}</span>
                </div>
                <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
                  {(byStage[s] || []).map((b) => (
                    <div key={b.id} className="card-flat p-3" data-testid={`bill-card-${b.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[11px] text-slate-500">{b.bill_number}</div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{b.type}</span>
                      </div>
                      <div className="text-[13px] font-medium text-slate-900 mt-1 truncate">{b.contractor}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="font-display text-lg font-bold text-slate-900 flex items-center">
                          <IndianRupee className="w-3.5 h-3.5" />{b.value_lakh.toFixed(1)}<span className="text-[10px] text-slate-500 ml-1 font-sans font-normal">L</span>
                        </div>
                        {s !== "Paid" && (
                          <button data-testid={`bill-advance-${b.id}`} onClick={() => advance(b.id)} className="text-xs px-2 py-1 hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-sm font-semibold inline-flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Aging: {b.aging_days || 0}d</div>
                    </div>
                  ))}
                  {!loading && (byStage[s] || []).length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-sm">Empty</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
