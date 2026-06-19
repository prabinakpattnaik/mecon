import React, { useEffect, useState } from "react";
import FormDialog, { Field, inputCls } from "./FormDialog";
import api, { formatApiError } from "../api/client";

export default function CreateDPRDialog({ open, onClose, onCreated }) {
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    project_id: "",
    package_id: "",
    date: new Date().toISOString().slice(0, 10),
    planned_pct: "",
    actual_pct: "",
    manpower: "",
    equipment: "",
    activities: "",
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
      const payload = {
        ...form,
        planned_pct: parseFloat(form.planned_pct || 0),
        actual_pct: parseFloat(form.actual_pct || 0),
        manpower: parseInt(form.manpower || 0, 10),
        equipment: parseInt(form.equipment || 0, 10),
      };
      const { data } = await api.post("/dpr", payload);
      onCreated?.(data);
      onClose?.();
      setForm({ project_id: "", package_id: "", date: new Date().toISOString().slice(0, 10), planned_pct: "", actual_pct: "", manpower: "", equipment: "", activities: "" });
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
      title="Submit Daily Progress Report"
      description="DPR captures the day's planned vs actual progress, deployment and activities."
      onSubmit={submit}
      submitting={submitting}
      error={error}
      submitLabel="Submit DPR"
      testId="create-dpr-dialog"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" required>
          <select data-testid="dpr-project" required value={form.project_id} onChange={upd("project_id")} className={inputCls}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Package" required>
          <select data-testid="dpr-package" required value={form.package_id} onChange={upd("package_id")} className={inputCls} disabled={!form.project_id}>
            <option value="">Select package…</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.discipline}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Date" required>
        <input data-testid="dpr-date" required type="date" value={form.date} onChange={upd("date")} className={inputCls} />
      </Field>
      <div className="grid grid-cols-4 gap-3">
        <Field label="Planned %" required>
          <input data-testid="dpr-planned" required type="number" step="0.01" value={form.planned_pct} onChange={upd("planned_pct")} className={inputCls} placeholder="3.5" />
        </Field>
        <Field label="Actual %" required>
          <input data-testid="dpr-actual" required type="number" step="0.01" value={form.actual_pct} onChange={upd("actual_pct")} className={inputCls} placeholder="2.8" />
        </Field>
        <Field label="Manpower" required>
          <input data-testid="dpr-manpower" required type="number" value={form.manpower} onChange={upd("manpower")} className={inputCls} placeholder="125" />
        </Field>
        <Field label="Equipment" required>
          <input data-testid="dpr-equipment" required type="number" value={form.equipment} onChange={upd("equipment")} className={inputCls} placeholder="12" />
        </Field>
      </div>
      <Field label="Activities Performed" required>
        <textarea data-testid="dpr-activities" required value={form.activities} onChange={upd("activities")} className={inputCls} rows={3} placeholder="Civil — Foundation pour pier P-12 (M-40, 28 cum); Reinforcement pier P-13…" />
      </Field>
    </FormDialog>
  );
}
