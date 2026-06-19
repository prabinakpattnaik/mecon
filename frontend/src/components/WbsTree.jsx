import React, { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FolderTree, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import StatusBadge from "./StatusBadge";
import api from "../api/client";

function buildIndex(items) {
  const byParent = {};
  items.forEach((i) => {
    const k = i.parent_id || "__root__";
    if (!byParent[k]) byParent[k] = [];
    byParent[k].push(i);
  });
  Object.keys(byParent).forEach((k) =>
    byParent[k].sort((a, b) => (a.code || "").localeCompare(b.code || ""))
  );
  return byParent;
}

function flatten(byParent, expanded) {
  const out = [];
  const roots = byParent["__root__"] || [];
  const stack = roots.map((r) => ({ node: r, depth: 0 }));
  while (stack.length) {
    const { node, depth } = stack.shift();
    const kids = byParent[node.id] || [];
    out.push({ node, depth, hasKids: kids.length > 0 });
    if (kids.length && expanded.has(node.id)) {
      const items = kids.map((c) => ({ node: c, depth: depth + 1 }));
      stack.unshift(...items);
    }
  }
  return out;
}

export default function WbsTree({ items, projectId, editable = false, onChange }) {
  const byParent = useMemo(() => buildIndex(items || []), [items]);
  const defaultExpanded = useMemo(() => {
    const s = new Set();
    (items || []).forEach((i) => {
      if ((i.level || 1) <= 2) s.add(i.id);
    });
    return s;
  }, [items]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [adding, setAdding] = useState(null); // parent_id for new child
  const [newRow, setNewRow] = useState({ code: "", name: "", weightage: 0, planned_start: "", planned_end: "" });
  const [busy, setBusy] = useState(false);

  const toggle = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const startEdit = (node) => {
    setEditingId(node.id);
    setEditValues({
      name: node.name || "",
      progress: node.progress || 0,
      weightage: node.weightage || 0,
      planned_start: node.planned_start || "",
      planned_end: node.planned_end || "",
    });
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api.patch(`/wbs/${editingId}`, {
        ...editValues,
        progress: parseFloat(editValues.progress),
        weightage: parseFloat(editValues.weightage),
      });
      setEditingId(null);
      onChange?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const removeNode = async (id) => {
    if (!window.confirm("Delete this WBS node and all its children?")) return;
    setBusy(true);
    try {
      await api.delete(`/wbs/${id}`);
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const submitNewChild = async () => {
    if (!newRow.code || !newRow.name) return;
    setBusy(true);
    try {
      await api.post("/wbs", {
        project_id: projectId,
        parent_id: adding,
        code: newRow.code,
        name: newRow.name,
        weightage: parseFloat(newRow.weightage || 0),
        planned_start: newRow.planned_start || null,
        planned_end: newRow.planned_end || null,
      });
      setAdding(null);
      setNewRow({ code: "", name: "", weightage: 0, planned_start: "", planned_end: "" });
      // Expand parent so new child is visible
      if (adding) setExpanded(new Set([...expanded, adding]));
      onChange?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8 border border-dashed border-slate-200 rounded-sm">
        <FolderTree className="w-6 h-6 mx-auto text-slate-300 mb-2" />
        No WBS items yet.
        {editable && (
          <div className="mt-3">
            <button
              data-testid="wbs-add-root"
              onClick={() => setAdding("__root__")}
              className="text-xs font-semibold px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-sm inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" /> Add Root Node
            </button>
          </div>
        )}
      </div>
    );
  }

  const rows = flatten(byParent, expanded);
  const colsHeader = editable ? "grid-cols-[1fr_180px_140px_70px_90px_120px]" : "grid-cols-[1fr_180px_140px_70px_90px]";

  return (
    <div className="border border-slate-200 rounded-sm overflow-hidden" data-testid="wbs-tree">
      <div className={`grid ${colsHeader} gap-2 bg-slate-50 px-2 py-2 text-overline`}>
        <div>WBS Element</div>
        <div>Planned Window</div>
        <div>Progress</div>
        <div className="text-right">Weight</div>
        <div>Status</div>
        {editable && <div className="text-right">Actions</div>}
      </div>

      {rows.map(({ node, depth, hasKids }) => {
        const isOpen = expanded.has(node.id);
        const isEditing = editingId === node.id;
        const pct = Math.min(100, node.progress || 0);
        const progressColor =
          node.progress >= 100 ? "bg-emerald-600" : node.progress > 0 ? "bg-blue-700" : "bg-slate-300";
        return (
          <div key={node.id} data-testid={"wbs-node-" + node.id}>
            <div
              className={`grid ${colsHeader} items-center gap-2 py-1.5 px-2 hover:bg-slate-50 border-b border-slate-100 text-sm`}
              style={{ paddingLeft: depth * 18 + 8 + "px" }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {hasKids ? (
                  <button onClick={() => toggle(node.id)} data-testid={"wbs-toggle-" + node.id} className="text-slate-500 hover:text-slate-900 flex-shrink-0">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <span className="w-3.5 inline-block flex-shrink-0"></span>
                )}
                <span className="font-mono text-xs text-slate-500 flex-shrink-0">L{node.level}</span>
                <span className="font-mono text-xs text-slate-600 flex-shrink-0">{node.code}</span>
                {isEditing ? (
                  <input
                    data-testid={`wbs-edit-name-${node.id}`}
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                    className="flex-1 text-sm border border-blue-600 rounded-sm px-2 py-0.5 outline-none"
                  />
                ) : (
                  <span className="font-medium text-slate-900 truncate">{node.name}</span>
                )}
              </div>

              <div className="text-xs font-mono text-slate-600">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input type="date" value={editValues.planned_start} onChange={(e) => setEditValues({ ...editValues, planned_start: e.target.value })} className="text-xs border border-slate-300 rounded-sm px-1 py-0.5 w-[80px]" />
                    <input type="date" value={editValues.planned_end} onChange={(e) => setEditValues({ ...editValues, planned_end: e.target.value })} className="text-xs border border-slate-300 rounded-sm px-1 py-0.5 w-[80px]" />
                  </div>
                ) : (
                  <span>{node.planned_start} → {node.planned_end}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editValues.progress}
                    onChange={(e) => setEditValues({ ...editValues, progress: e.target.value })}
                    data-testid={`wbs-edit-progress-${node.id}`}
                    className="w-16 text-xs border border-slate-300 rounded-sm px-2 py-0.5"
                  />
                ) : (
                  <>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div className={"h-full " + progressColor} style={{ width: pct + "%" }}></div>
                    </div>
                    <span className="font-mono text-xs text-slate-700 w-9 text-right">{node.progress || 0}%</span>
                  </>
                )}
              </div>

              <div className="text-xs text-slate-600 text-right font-mono">
                {isEditing ? (
                  <input type="number" step="0.1" value={editValues.weightage} onChange={(e) => setEditValues({ ...editValues, weightage: e.target.value })} className="w-14 text-xs border border-slate-300 rounded-sm px-1 py-0.5" />
                ) : (
                  `${node.weightage}%`
                )}
              </div>

              <div><StatusBadge value={node.status} /></div>

              {editable && (
                <div className="flex justify-end gap-0.5">
                  {isEditing ? (
                    <>
                      <button data-testid={`wbs-save-${node.id}`} disabled={busy} onClick={saveEdit} className="p-1 hover:bg-emerald-50 text-emerald-700 rounded-sm"><Check className="w-3.5 h-3.5" /></button>
                      <button data-testid={`wbs-cancel-${node.id}`} onClick={() => setEditingId(null)} className="p-1 hover:bg-slate-100 text-slate-600 rounded-sm"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <button data-testid={`wbs-add-child-${node.id}`} disabled={node.level >= 10} title={node.level >= 10 ? "Max 10 levels" : "Add child"} onClick={() => { setAdding(node.id); setExpanded(new Set([...expanded, node.id])); }} className="p-1 hover:bg-blue-50 text-blue-700 rounded-sm disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
                      <button data-testid={`wbs-edit-${node.id}`} onClick={() => startEdit(node)} className="p-1 hover:bg-slate-100 text-slate-700 rounded-sm"><Pencil className="w-3 h-3" /></button>
                      <button data-testid={`wbs-delete-${node.id}`} onClick={() => removeNode(node.id)} disabled={busy} className="p-1 hover:bg-red-50 text-red-700 rounded-sm"><Trash2 className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Add-child inline row */}
            {editable && adding === node.id && (
              <div
                className="grid grid-cols-[1fr_180px_140px_70px_90px_120px] items-center gap-2 py-1.5 px-2 bg-blue-50/30 border-b border-blue-200 text-sm"
                style={{ paddingLeft: (depth + 1) * 18 + 8 + "px" }}
                data-testid={`wbs-newchild-row-${node.id}`}
              >
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3 h-3 text-blue-700" />
                  <input data-testid="wbs-new-code" autoFocus value={newRow.code} onChange={(e) => setNewRow({ ...newRow, code: e.target.value })} placeholder="Code" className="font-mono text-xs border border-slate-300 rounded-sm px-1 py-0.5 w-20" />
                  <input data-testid="wbs-new-name" value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Element name" className="flex-1 text-xs border border-slate-300 rounded-sm px-2 py-0.5" />
                </div>
                <div className="flex items-center gap-1">
                  <input type="date" value={newRow.planned_start} onChange={(e) => setNewRow({ ...newRow, planned_start: e.target.value })} className="text-xs border border-slate-300 rounded-sm px-1 py-0.5 w-[80px]" />
                  <input type="date" value={newRow.planned_end} onChange={(e) => setNewRow({ ...newRow, planned_end: e.target.value })} className="text-xs border border-slate-300 rounded-sm px-1 py-0.5 w-[80px]" />
                </div>
                <div></div>
                <div className="text-right">
                  <input type="number" step="0.1" value={newRow.weightage} onChange={(e) => setNewRow({ ...newRow, weightage: e.target.value })} className="w-14 text-xs border border-slate-300 rounded-sm px-1 py-0.5" />
                </div>
                <div></div>
                <div className="flex justify-end gap-0.5">
                  <button data-testid="wbs-newchild-save" disabled={busy} onClick={submitNewChild} className="p-1 hover:bg-emerald-50 text-emerald-700 rounded-sm"><Check className="w-3.5 h-3.5" /></button>
                  <button data-testid="wbs-newchild-cancel" onClick={() => setAdding(null)} className="p-1 hover:bg-slate-100 text-slate-600 rounded-sm"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
