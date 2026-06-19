import React, { useEffect, useState } from "react";
import FormDialog, { Field, inputCls } from "./FormDialog";
import api, { formatApiError } from "../api/client";

export default function CreateNCRDialog({ open, onClose, onCreated }) {
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    project_id: "",
    package_id: "",
    description: "",
    severity: "Medium",
    responsible: "",
    target_closure: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.get("/projects").then((r) => setProjects(r.data));
    }
  }, [open]);

  useEffect(() => {
    if (form.project_id) {
      api.get(`/packages?project_id=${form.project_id}`).then((r) => setPackages(r.data));
    } else {
      setPackages([]);
    }
  }, [form.project_id]);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/ncrs", form);
      onCreated?.(data);
      onClose?.();
      setForm({ project_id: "", package_id: "", description: "", severity: "Medium", responsible: "", target_closure: "" });
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Raise New NCR"
      description="Non-conformance report — capture defect against drawing/specification."
      onSubmit={submit}
      submitting={submitting}
      error={error}
      submitLabel="Raise NCR"
      testId="create-ncr-dialog"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" required>
          <select data-testid="ncr-project" required value={form.project_id} onChange={upd("project_id")} className={inputCls}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} – {p.name}</option>)}
          </select>
        </Field>
        <Field label="Package" required>
          <select data-testid="ncr-package" required value={form.package_id} onChange={upd("package_id")} className={inputCls} disabled={!form.project_id}>
            <option value="">Select package…</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.discipline}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description" required>
        <textarea data-testid="ncr-description" required value={form.description} onChange={upd("description")} className={inputCls} rows={3} placeholder="Describe the non-conformance observed…" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Severity" required>
          <select data-testid="ncr-severity" value={form.severity} onChange={upd("severity")} className={inputCls}>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>
        <Field label="Responsible Agency" required>
          <input data-testid="ncr-responsible" required value={form.responsible} onChange={upd("responsible")} className={inputCls} placeholder="e.g. L&T Construction" />
        </Field>
        <Field label="Target Closure" required>
          <input data-testid="ncr-target" required type="date" value={form.target_closure} onChange={upd("target_closure")} className={inputCls} />
        </Field>
      </div>
    </FormDialog>
  );
}
