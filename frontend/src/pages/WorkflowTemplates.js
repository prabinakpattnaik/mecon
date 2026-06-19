import React, { useEffect, useState } from "react";
import api, { formatApiError } from "../api/client";
import { Plus, Trash2, GitBranch, X, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";

const TYPES = ["drawing", "dpr", "ncr", "hindrance", "bill", "generic"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export default function WorkflowTemplates() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "drawing",
    description: "",
    default_priority: "Medium",
    default_sla_hours: 48,
    stages: ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator"],
  });
  const [stageInput, setStageInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/workflow-templates").then((r) => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const canManage = user && ["admin", "ProjectCoordinator"].includes(user.role);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/workflow-templates", form);
      setShowCreate(false);
      setForm({ name: "", type: "drawing", description: "", default_priority: "Medium", default_sla_hours: 48, stages: ["Reviewer", "Section Incharge", "Package Coordinator", "Project Coordinator"] });
      load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (tid) => {
    if (!window.confirm("Delete this template?")) return;
    await api.delete(`/workflow-templates/${tid}`);
    load();
  };

  const addStage = () => {
    if (!stageInput.trim()) return;
    setForm({ ...form, stages: [...form.stages, stageInput.trim()] });
    setStageInput("");
  };

  const removeStage = (i) => {
    const next = [...form.stages];
    next.splice(i, 1);
    setForm({ ...form, stages: next });
  };

  return (
    <div className="space-y-5" data-testid="workflow-templates-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-overline">Configuration</div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 mt-1">Workflow Templates</h1>
          <p className="text-sm text-slate-600 mt-1">Reusable approval workflow blueprints per document type.</p>
        </div>
        {canManage && (
          <button
            data-testid="wft-create-button"
            onClick={() => setShowCreate(true)}
            className="text-sm font-semibold px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        )}
      </div>

      {loading && <div className="text-overline text-slate-500">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="card-flat p-10 text-center">
          <GitBranch className="w-8 h-8 mx-auto text-slate-300 mb-3" />
          <div className="text-sm font-semibold text-slate-700">No templates yet</div>
          <div className="text-xs text-slate-500 mt-1">Create your first reusable workflow blueprint.</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {items.map((t) => (
          <div key={t.id} className="card-flat p-5" data-testid={`wft-card-${t.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-overline">{t.type}</div>
                <h3 className="font-display text-base font-semibold text-slate-900 tracking-tight">{t.name}</h3>
                {t.description && <p className="text-xs text-slate-600 mt-1">{t.description}</p>}
              </div>
              {canManage && (
                <button data-testid={`wft-delete-${t.id}`} onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-overline">Priority</span>
              <span className="font-mono text-slate-700">{t.default_priority}</span>
              <span className="text-overline ml-3">SLA</span>
              <span className="font-mono text-slate-700">{t.default_sla_hours}h</span>
            </div>
            <div className="mt-3">
              <div className="text-overline mb-1.5">Approval Chain</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {t.stages.map((s, i) => (
                  <React.Fragment key={i}>
                    <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-sm">
                      {i + 1}. {s}
                    </span>
                    {i < t.stages.length - 1 && <span className="text-slate-400 text-xs">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={(v) => !v && setShowCreate(false)}>
        <DialogContent className="rounded-sm max-w-2xl" data-testid="wft-create-dialog">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">New Workflow Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-overline">Name *</span>
                <input data-testid="wft-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600" />
              </label>
              <label className="block">
                <span className="text-overline">Type *</span>
                <select data-testid="wft-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600">
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-overline">Description</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-overline">Default Priority</span>
                <select value={form.default_priority} onChange={(e) => setForm({ ...form, default_priority: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600">
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-overline">Default SLA (hours)</span>
                <input type="number" min={1} value={form.default_sla_hours} onChange={(e) => setForm({ ...form, default_sla_hours: parseInt(e.target.value || 48, 10) })} className="mt-1 w-full border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600" />
              </label>
            </div>

            <div>
              <span className="text-overline">Approval Stages ({form.stages.length})</span>
              <div className="mt-1 space-y-1.5 border border-slate-200 rounded-sm p-2 max-h-44 overflow-y-auto">
                {form.stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" data-testid={`wft-stage-${i}`}>
                    <span className="font-mono text-xs text-slate-500 w-5">{i + 1}.</span>
                    <span className="flex-1 font-medium text-slate-900">{s}</span>
                    <button type="button" onClick={() => removeStage(i)} className="text-slate-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  data-testid="wft-stage-input"
                  value={stageInput}
                  onChange={(e) => setStageInput(e.target.value)}
                  placeholder="Add stage name…"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
                  className="flex-1 border border-slate-300 rounded-sm px-3 py-1.5 text-sm outline-none focus:border-blue-600"
                />
                <button
                  data-testid="wft-add-stage"
                  type="button"
                  onClick={addStage}
                  className="text-xs font-semibold px-3 py-1.5 border border-slate-300 hover:border-blue-600 hover:text-blue-700 rounded-sm inline-flex items-center gap-1"
                ><Plus className="w-3 h-3" /> Add</button>
              </div>
            </div>

            {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">{error}</div>}

            <DialogFooter className="pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="text-sm px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-sm">Cancel</button>
              <button type="submit" data-testid="wft-submit" disabled={submitting} className="text-sm px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-sm">
                {submitting ? "Saving…" : "Create Template"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
