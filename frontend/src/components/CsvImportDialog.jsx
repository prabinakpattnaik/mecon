import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import api, { formatApiError, API } from "../api/client";
import { Upload, FileSpreadsheet, Download } from "lucide-react";

const SAMPLE_CSV = `code,parent_code,name,weightage,planned_start,planned_end
ROOT,,Project Root,100,2026-01-01,2027-12-31
ENG,ROOT,Engineering,25,2026-01-01,2026-08-31
ENG.1,ENG,Process Design,40,2026-01-01,2026-04-30
ENG.2,ENG,Detail Engineering,60,2026-05-01,2026-08-31
CON,ROOT,Construction,50,2026-04-01,2027-10-31
CON.1,CON,Civil Works,30,2026-04-01,2026-12-31
CON.2,CON,Erection,40,2026-09-01,2027-06-30
`;

export default function CsvImportDialog({ open, onClose, projectId, onImported }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const submit = async () => {
    if (!file) {
      setError("Please choose a CSV file");
      return;
    }
    setError("");
    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const tok = localStorage.getItem("mecon_token");
      const res = await fetch(`${API}/wbs/import?project_id=${projectId}`, {
        method: "POST",
        body: fd,
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Import failed");
      setResult(data);
      setTimeout(() => {
        onImported?.();
        onClose?.();
        setFile(null);
        setResult(null);
      }, 800);
    } catch (e) {
      setError(formatApiError(e) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wbs_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="rounded-sm max-w-lg" data-testid="csv-import-dialog">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Bulk Import WBS</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Upload a CSV file with columns: <code className="font-mono text-[11px] text-slate-700">code, parent_code, name, weightage, planned_start, planned_end</code>.
            Levels auto-computed from parent_code chain (max 10).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={downloadSample}
            data-testid="csv-download-sample"
            className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Download sample CSV
          </button>

          <label className="block border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-sm p-6 text-center cursor-pointer transition-colors">
            <input
              data-testid="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">
              {file ? file.name : "Click to select CSV file"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "or drag & drop"}
            </div>
          </label>

          {error && (
            <div data-testid="csv-error" className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
              {error}
            </div>
          )}

          {result && (
            <div data-testid="csv-success" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-sm">
              ✓ Imported {result.imported} WBS items successfully
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className="text-sm px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-sm" data-testid="csv-cancel">Cancel</button>
          <button
            disabled={submitting || !file}
            onClick={submit}
            data-testid="csv-submit"
            className="text-sm px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-sm inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> {submitting ? "Importing…" : "Import CSV"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
