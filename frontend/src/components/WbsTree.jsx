import React, { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import StatusBadge from "./StatusBadge";

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

// Flatten visible nodes iteratively based on `expanded` set
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

export default function WbsTree({ items }) {
  const byParent = useMemo(() => buildIndex(items || []), [items]);

  // Default expand levels 1 and 2 (depth 0 and 1)
  const defaultExpanded = useMemo(() => {
    const s = new Set();
    (items || []).forEach((i) => {
      if ((i.level || 1) <= 2) s.add(i.id);
    });
    return s;
  }, [items]);

  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8 border border-dashed border-slate-200 rounded-sm">
        <FolderTree className="w-6 h-6 mx-auto text-slate-300 mb-2" />
        No WBS items yet.
      </div>
    );
  }

  const rows = flatten(byParent, expanded);

  return (
    <div className="border border-slate-200 rounded-sm overflow-hidden" data-testid="wbs-tree">
      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-2 py-2 text-overline">
        <div className="col-span-6">WBS Element</div>
        <div className="col-span-2">Planned Window</div>
        <div className="col-span-2">Progress</div>
        <div className="col-span-1 text-right">Weight</div>
        <div className="col-span-1">Status</div>
      </div>
      {rows.map(({ node, depth, hasKids }) => {
        const isOpen = expanded.has(node.id);
        const pct = Math.min(100, node.progress || 0);
        const progressColor =
          node.progress >= 100 ? "bg-emerald-600" : node.progress > 0 ? "bg-blue-700" : "bg-slate-300";
        return (
          <div key={node.id} data-testid={"wbs-node-" + node.id}>
            <div
              className="grid grid-cols-12 items-center gap-2 py-1.5 px-2 hover:bg-slate-50 border-b border-slate-100 text-sm"
              style={{ paddingLeft: depth * 18 + 8 + "px" }}
            >
              <div className="col-span-6 flex items-center gap-1.5 min-w-0">
                {hasKids ? (
                  <button
                    onClick={() => toggle(node.id)}
                    data-testid={"wbs-toggle-" + node.id}
                    className="text-slate-500 hover:text-slate-900 flex-shrink-0"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-3.5 inline-block flex-shrink-0"></span>
                )}
                <span className="font-mono text-xs text-slate-500 flex-shrink-0">L{node.level}</span>
                <span className="font-mono text-xs text-slate-600 flex-shrink-0">{node.code}</span>
                <span className="font-medium text-slate-900 truncate">{node.name}</span>
              </div>
              <div className="col-span-2 text-xs text-slate-600 font-mono">
                {node.planned_start} → {node.planned_end}
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                  <div className={"h-full " + progressColor} style={{ width: pct + "%" }}></div>
                </div>
                <span className="font-mono text-xs text-slate-700 w-9 text-right">{node.progress || 0}%</span>
              </div>
              <div className="col-span-1 text-xs text-slate-600 text-right font-mono">{node.weightage}%</div>
              <div className="col-span-1">
                <StatusBadge value={node.status} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
