import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

export default function FormDialog({
  open,
  onClose,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Create",
  submitting = false,
  error = "",
  testId = "form-dialog",
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="rounded-sm max-w-xl" data-testid={testId}>
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-slate-500">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(e);
          }}
          className="space-y-3 mt-2"
        >
          {children}

          {error && (
            <div data-testid="form-error" className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="form-cancel"
              className="text-sm px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="form-submit"
              className="text-sm px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold rounded-sm"
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="text-overline">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputCls =
  "w-full bg-white border border-slate-300 rounded-sm px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15";
