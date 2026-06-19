import React, { useEffect, useState } from "react";
import FormDialog, { Field, inputCls } from "./FormDialog";
import api, { formatApiError } from "../api/client";

const HIND_TYPES = [
  "Land Availability",
  "Drawing Delay",
  "Material Non-Availability",
  "Equipment Unavailability",
  "Contractor Delays",
  "Vendor Delays",
  "Client Constraint",
  "Utility Constraint",
  "Access Restriction",
  "Safety Restriction",
  "Regulatory",
  "Weather",
  "Quality Holds",
  "Technical Clarification",
  "Planning Deficiency",
];

export default function CreateHindranceDialog({ open, onClose, onCreated }) {
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    project_id: "",
    package_id: "",
    type: "Land Availability",
    severity: "Medium",
    description: "",
    responsible: "",
    target_closure: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) api.get("/projects").then((r) => setProjects(r.data)); }, [open]);
  useEffect(() => {
    if (form.project_id) api.get(`/packages?project_id=${form.project_id}`).then((r) => setPackages(r.data));
    else setPackages([]);
  }, [form.project_id]);

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...form, package_id: form.package_id || null };
      const { data } = await api.post("/hindrances", payload);
      onCreated?.(data);
      onClose?.();
      setForm({ project_id: "", package_id: "", type: "Land Availability", severity: "Medium", description: "", responsible: "", target_closure: "" });
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
      title="Register Hindrance"
      description="Record an execution hindrance that is impacting site progress."
      onSubmit={submit}
      submitting={submitting}
      error={error}
      submitLabel="Register Hindrance"
      testId="create-hindrance-dialog"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" required>
          <select data-testid="hnd-project" required value={form.project_id} onChange={upd("project_id")} className={inputCls}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Package">
          <select data-testid="hnd-package" value={form.package_id} onChange={upd("package_id")} className={inputCls} disabled={!form.project_id}>
            <option value="">— Not specific —</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.discipline}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" required>
          <select data-testid="hnd-type" value={form.type} onChange={upd("type")} className={inputCls}>
            {HIND_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Severity" required>
          <select data-testid="hnd-severity" value={form.severity} onChange={upd("severity")} className={inputCls}>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>
      </div>
      <Field label="Description" required>
        <textarea data-testid="hnd-description" required value={form.description} onChange={upd("description")} className={inputCls} rows={3} placeholder="Describe the hindrance and its impact…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsible Agency" required>
          <input data-testid="hnd-responsible" required value={form.responsible} onChange={upd("responsible")} className={inputCls} placeholder="e.g. Client / Contractor / MECON" />
        </Field>
        <Field label="Target Closure" required>
          <input data-testid="hnd-target" required type="date" value={form.target_closure} onChange={upd("target_closure")} className={inputCls} />
        </Field>
      </div>
    </FormDialog>
  );
}
