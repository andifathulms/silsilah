"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Relationship } from "@/lib/types";
import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  computeTreeLayout,
  NODE_H,
  NODE_W,
  type LayoutNode,
} from "@/lib/tree-layout";

interface Props {
  people: Person[];
  relationships: Relationship[];
  /** Person to center the view on ("show me my branch"). */
  mainId?: number | null;
  onSelect?: (personId: number) => void;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.15;
const MAX_K = 2.4;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function genderClass(gender: string): string {
  const g = (gender || "").toLowerCase();
  if (g.startsWith("m")) return "male";
  if (g.startsWith("f") || g.startsWith("w")) return "female";
  return "genderless";
}

/**
 * Silsilah's own family-tree renderer — no third-party charting. Layout comes
 * from `computeTreeLayout`; this component draws the SVG (couple + parent-child
 * links and HTML cards) and owns pan / zoom / select / recenter.
 */
export default function TreeView({ people, relationships, mainId, onSelect }: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tf, setTf] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [animate, setAnimate] = useState(false);
  const [active, setActive] = useState<number | null>(mainId ?? null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [hoverId, setHoverId] = useState<number | null>(null);

  // Child/parent/spouse maps (from full data) for collapse logic + toggles.
  const { childrenOf, parentsOf, spousesOf } = useMemo(() => {
    const c = new Map<number, number[]>();
    const p = new Map<number, number[]>();
    const s = new Map<number, number[]>();
    for (const r of relationships) {
      if (r.type === "parent_child") {
        (c.get(r.person_a) ?? c.set(r.person_a, []).get(r.person_a)!).push(r.person_b);
        (p.get(r.person_b) ?? p.set(r.person_b, []).get(r.person_b)!).push(r.person_a);
      } else if (r.type === "spouse") {
        (s.get(r.person_a) ?? s.set(r.person_a, []).get(r.person_a)!).push(r.person_b);
        (s.get(r.person_b) ?? s.set(r.person_b, []).get(r.person_b)!).push(r.person_a);
      }
    }
    return { childrenOf: c, parentsOf: p, spousesOf: s };
  }, [relationships]);

  // A person is hidden when every one of their parents is "closed" — collapsed,
  // already hidden, or married to a collapsed person (children hang from a
  // couple, so folding one spouse folds the family). A child with a separate
  // still-visible parent (branches joined by marriage) stays put.
  const hidden = useMemo(() => {
    const hide = new Set<number>();
    if (collapsed.size === 0) return hide;
    const closed = (pp: number) =>
      collapsed.has(pp) ||
      hide.has(pp) ||
      (spousesOf.get(pp) ?? []).some((s) => collapsed.has(s));
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of people) {
        if (collapsed.has(p.id) || hide.has(p.id)) continue;
        const par = parentsOf.get(p.id) ?? [];
        if (par.length > 0 && par.every(closed)) {
          hide.add(p.id);
          changed = true;
        }
      }
    }
    return hide;
  }, [collapsed, people, parentsOf, spousesOf]);

  const hiddenCount = useMemo(() => {
    // For each collapsed node, how many of its descendants are hidden.
    const counts = new Map<number, number>();
    for (const c of collapsed) {
      let n = 0;
      const stack = [...(childrenOf.get(c) ?? [])];
      const seen = new Set<number>();
      while (stack.length) {
        const x = stack.pop()!;
        if (seen.has(x)) continue;
        seen.add(x);
        if (hidden.has(x)) n++;
        for (const cc of childrenOf.get(x) ?? []) stack.push(cc);
      }
      counts.set(c, n);
    }
    return counts;
  }, [collapsed, childrenOf, hidden]);

  const { visiblePeople, visibleRels } = useMemo(() => {
    if (hidden.size === 0) return { visiblePeople: people, visibleRels: relationships };
    const vp = people.filter((p) => !hidden.has(p.id));
    const vr = relationships.filter(
      (r) => !hidden.has(r.person_a) && !hidden.has(r.person_b)
    );
    return { visiblePeople: vp, visibleRels: vr };
  }, [people, relationships, hidden]);

  const layout = useMemo(
    () => computeTreeLayout(visiblePeople, visibleRels),
    [visiblePeople, visibleRels]
  );
  const nodeById = useMemo(() => {
    const m = new Map<number, LayoutNode>();
    layout.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout]);

  // On hover: the person + their immediate family (parents, spouses, children).
  const related = useMemo(() => {
    if (hoverId == null) return null;
    const s = new Set<number>([hoverId]);
    for (const x of parentsOf.get(hoverId) ?? []) s.add(x);
    for (const x of childrenOf.get(hoverId) ?? []) s.add(x);
    for (const x of spousesOf.get(hoverId) ?? []) s.add(x);
    return s;
  }, [hoverId, parentsOf, childrenOf, spousesOf]);

  function toggleCollapse(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Measure the container.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitAll = useCallback(
    (smooth = false) => {
      if (!size.w || !size.h || !layout.width) return;
      const k = clamp(
        Math.min(size.w / layout.width, size.h / layout.height, 1),
        MIN_K,
        MAX_K
      );
      setAnimate(smooth);
      setTf({
        x: (size.w - layout.width * k) / 2,
        y: Math.max(24, (size.h - layout.height * k) / 2),
        k,
      });
    },
    [size, layout]
  );

  // Fit the whole tree when the underlying data (or first size) changes —
  // not on collapse, so folding a branch doesn't yank the whole view.
  useEffect(() => {
    fitAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, size.w, size.h]);

  function zoomBy(factor: number) {
    if (!size.w) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    setAnimate(true);
    setTf((cur) => {
      const k = clamp(cur.k * factor, MIN_K, MAX_K);
      const r = k / cur.k;
      return { x: cx - (cx - cur.x) * r, y: cy - (cy - cur.y) * r, k };
    });
  }

  const parentIds = useMemo(
    () => people.filter((p) => (childrenOf.get(p.id)?.length ?? 0) > 0).map((p) => p.id),
    [people, childrenOf]
  );
  function collapseAll() {
    setCollapsed(new Set(parentIds));
  }
  function expandAll() {
    setCollapsed(new Set());
  }

  // Center on a specific person when asked (search / "center here").
  const centerOn = useCallback(
    (id: number, smooth = true) => {
      const n = nodeById.get(id);
      if (!n || !size.w) return;
      // Keep the current zoom (only nudge up if extremely zoomed out) so
      // focusing a person pans without a jarring jump.
      const k = clamp(Math.max(tf.k, 0.4), MIN_K, MAX_K);
      setAnimate(smooth);
      setTf({
        x: size.w / 2 - (n.x + NODE_W / 2) * k,
        y: size.h / 2.4 - (n.y + NODE_H / 2) * k,
        k,
      });
    },
    [nodeById, size, tf.k]
  );

  useEffect(() => {
    if (mainId != null) {
      setActive(mainId);
      centerOn(mainId, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainId]);

  // --- Wheel zoom (around the cursor) ---
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setAnimate(false);
      setTf((cur) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const k = clamp(cur.k * factor, MIN_K, MAX_K);
        const ratio = k / cur.k;
        return { x: px - (px - cur.x) * ratio, y: py - (py - cur.y) * ratio, k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // --- Drag to pan ---
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y, moved: false };
    setAnimate(false);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setTf((cur) => ({ ...cur, x: drag.current!.ox + dx, y: drag.current!.oy + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function handleNodeClick(id: number) {
    if (drag.current?.moved) return; // was a pan, not a click
    setActive(id);
    onSelect?.(id);
    centerOn(id, true);
  }

  const empty = layout.nodes.length === 0;

  return (
    <div
      ref={wrapRef}
      className={`tree-canvas${empty ? " tree-empty" : ""}`}
      onPointerDown={empty ? undefined : onPointerDown}
      onPointerMove={empty ? undefined : onPointerMove}
      onPointerUp={empty ? undefined : onPointerUp}
      onPointerLeave={empty ? undefined : onPointerUp}
    >
      {empty && <p className="muted">{t("tree.emptyPeople")}</p>}
      {!empty && (
        // One CSS-transformed "world" holds both the links SVG and the HTML
        // cards, so pan/zoom moves everything together (no foreignObject —
        // which fails to follow SVG transforms in some browsers).
        <div
          className="tree-world"
          style={{
            transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.k})`,
            transformOrigin: "0 0",
            transition: animate ? "transform 0.5s cubic-bezier(0.16,1,0.3,1)" : "none",
          }}
        >
          <svg
            className={`tree-links${related ? " has-hover" : ""}`}
            width={layout.width}
            height={layout.height}
            style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
          >
            {layout.couples.map((c, i) => {
              const a = nodeById.get(c.a);
              const b = nodeById.get(c.b);
              if (!a || !b) return null;
              const y = a.y + NODE_H / 2;
              const x1 = Math.min(a.x, b.x) + NODE_W;
              const x2 = Math.max(a.x, b.x);
              const hi = c.a === hoverId || c.b === hoverId;
              return (
                <line
                  key={`c${i}`}
                  className={`link-couple${hi ? " hi" : ""}`}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                />
              );
            })}
            {layout.childLinks.map((cl) => {
              const child = nodeById.get(cl.child);
              const parents = cl.parents.map((p) => nodeById.get(p)!).filter(Boolean);
              if (!child || parents.length === 0) return null;
              const px = parents.reduce((s, p) => s + p.x + NODE_W / 2, 0) / parents.length;
              const py = Math.max(...parents.map((p) => p.y)) + NODE_H;
              const cx = child.x + NODE_W / 2;
              const cy = child.y;
              const midY = py + (cy - py) / 2;
              const hi = cl.child === hoverId || cl.parents.includes(hoverId ?? -1);
              return (
                <path
                  key={`l${cl.child}`}
                  className={`link-parent${hi ? " hi" : ""}`}
                  d={`M ${px} ${py} V ${midY} H ${cx} V ${cy}`}
                  fill="none"
                />
              );
            })}
          </svg>

          {layout.nodes.map((n) => (
            <div
              key={n.id}
              style={{ position: "absolute", left: n.x, top: n.y, width: NODE_W }}
              onMouseEnter={() => !drag.current && setHoverId(n.id)}
              onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
            >
              <TreeCard
                node={n}
                selected={n.id === active}
                dimmed={related != null && !related.has(n.id)}
                sublabel={sublabel(n.person, t)}
                hasChildren={(childrenOf.get(n.id)?.length ?? 0) > 0}
                collapsed={collapsed.has(n.id)}
                hiddenCount={hiddenCount.get(n.id) ?? 0}
                onClick={() => handleNodeClick(n.id)}
                onToggleCollapse={() => toggleCollapse(n.id)}
              />
            </div>
          ))}
        </div>
      )}

      {!empty && (
        <div className="tree-controls" onPointerDown={(e) => e.stopPropagation()}>
          {parentIds.length > 0 && (
            <button
              className="tree-ctrl wide"
              onClick={() => (collapsed.size ? expandAll() : collapseAll())}
              title={collapsed.size ? t("tree.expandAll") : t("tree.collapseAll")}
            >
              {collapsed.size ? "⧉" : "⧈"}{" "}
              <span className="hide-sm">
                {collapsed.size ? t("tree.expandAll") : t("tree.collapseAll")}
              </span>
            </button>
          )}
          <button className="tree-ctrl" onClick={() => zoomBy(1 / 1.25)} title={t("tree.zoomOut")}>−</button>
          <button className="tree-ctrl" onClick={() => zoomBy(1.25)} title={t("tree.zoomIn")}>+</button>
          <button className="tree-ctrl" onClick={() => fitAll(true)} title={t("tree.fit")}>⤢</button>
        </div>
      )}
    </div>
  );
}

function TreeCard({
  node,
  selected,
  dimmed,
  sublabel,
  hasChildren,
  collapsed,
  hiddenCount,
  onClick,
  onToggleCollapse,
}: {
  node: LayoutNode;
  selected: boolean;
  dimmed: boolean;
  sublabel: string;
  hasChildren: boolean;
  collapsed: boolean;
  hiddenCount: number;
  onClick: () => void;
  onToggleCollapse: () => void;
}) {
  const p = node.person;
  const photo = mediaUrl(p.photo);
  const cls = [
    "tree-node",
    genderClass(p.gender),
    p.is_living ? "" : "deceased",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    photo ? "has-photo" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // Offer the toggle only when this node actually has a foldable subtree
  // (children now, or hidden descendants while collapsed).
  const showToggle = hasChildren && (!collapsed || hiddenCount > 0);
  return (
    <div className={cls} onClick={onClick} role="button" title={p.name}>
      <div className="tree-node-avatar">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <span aria-hidden>👤</span>
        )}
      </div>
      <div className="tree-node-body">
        <div className="tree-node-name">{p.name}</div>
        {sublabel && <div className="tree-node-sub">{sublabel}</div>}
      </div>
      {showToggle && (
        <button
          className="tree-node-toggle"
          title={collapsed ? "Expand" : "Collapse"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {collapsed ? `+${hiddenCount}` : "–"}
        </button>
      )}
    </div>
  );
}

/** Compact, localized node sublabel: "b. 1965", "† 1940–2015", "† in memory". */
function sublabel(p: Person, t: (k: string, v?: Record<string, string | number>) => string): string {
  const b = p.birth_date ? p.birth_date.slice(0, 4) : "";
  const d = p.death_date ? p.death_date.slice(0, 4) : "";
  if (!p.is_living) {
    if (b && d) return `† ${b}–${d}`;
    if (d) return `† ${d}`;
    if (b) return `† ${b}`;
    return `† ${t("person.inMemory")}`;
  }
  if (b) return `${t("node.born")} ${b}`;
  return "";
}
