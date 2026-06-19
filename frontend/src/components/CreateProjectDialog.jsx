import React, { useState } from "react";
import FormDialog, { Field, inputCls } from "./FormDialog";
import api, { formatApiError } from "../api/client";

export default function CreateProjectDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    client: "",
    location: "",
    start_date: "",
    end_date: "",
    value_cr: "",
    manager: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        value_cr: parseFloat(form.value_cr || 0),
      };
      const { data } = await api.post("/projects", payload);
      onCreated?.(data);
      onClose?.();
      setForm({ code: "", name: "", client: "", location: "", start_date: "", end_date: "", value_cr: "", manager: "", description: "" });
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
      title="New Project"
      description="Register a new mega-project under MECON monitoring."
      onSubmit={submit}
      submitting={submitting}
      error={error}
      submitLabel="Create Project"
      testId="create-project-dialog"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project Code" required>
          <input data-testid="proj-code" required value={form.code} onChange={upd("code")} className={inputCls} placeholder="e.g. BSP-EXP-4" />
        </Field>
        <Field label="Client" required>
          <input data-testid="proj-client" required value={form.client} onChange={upd("client")} className={inputCls} placeholder="e.g. SAIL" />
        </Field>
      </div>
      <Field label="Project Name" required>
        <input data-testid="proj-name" required value={form.name} onChange={upd("name")} className={inputCls} placeholder="e.g. Bhilai Steel Plant Phase-4 Expansion" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location" required>
          <input data-testid="proj-location" required value={form.location} onChange={upd("location")} className={inputCls} placeholder="e.g. Bhilai, Chhattisgarh" />
        </Field>
        <Field label="Contract Value (Cr)" required>
          <input data-testid="proj-value" required type="number" step="0.1" value={form.value_cr} onChange={upd("value_cr")} className={inputCls} placeholder="e.g. 5400" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date" required>
          <input data-testid="proj-start" required type="date" value={form.start_date} onChange={upd("start_date")} className={inputCls} />
        </Field>
        <Field label="End Date" required>
          <input data-testid="proj-end" required type="date" value={form.end_date} onChange={upd("end_date")} className={inputCls} />
        </Field>
      </div>
      <Field label="Project Manager">
        <input data-testid="proj-manager" value={form.manager} onChange={upd("manager")} className={inputCls} placeholder="e.g. MECON PMG Mr. Rajesh Kumar" />
      </Field>
      <Field label="Description">
        <textarea data-testid="proj-desc" value={form.description} onChange={upd("description")} className={inputCls} rows={2} placeholder="Brief scope description…" />
      </Field>
    </FormDialog>
  );
}
