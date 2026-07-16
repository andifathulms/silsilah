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

  const layout = useMemo(
    () => computeTreeLayout(people, relationships),
    [people, relationships]
  );
  const nodeById = useMemo(() => {
    const m = new Map<number, LayoutNode>();
    layout.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout]);

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

  // Fit the whole tree when the data (or first size) changes.
  const fitKey = `${layout.width}x${layout.height}`;
  useEffect(() => {
    if (!size.w || !size.h || !layout.width) return;
    const k = clamp(
      Math.min(size.w / layout.width, size.h / layout.height, 1),
      MIN_K,
      MAX_K
    );
    setAnimate(false);
    setTf({
      x: (size.w - layout.width * k) / 2,
      y: Math.max(24, (size.h - layout.height * k) / 2),
      k,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, size.w, size.h]);

  // Center on a specific person when asked (search / "center here").
  const centerOn = useCallback(
    (id: number, smooth = true) => {
      const n = nodeById.get(id);
      if (!n || !size.w) return;
      const k = clamp(Math.max(tf.k, 0.75), MIN_K, MAX_K);
      setAnimate(smooth);
      setTf({
        x: size.w / 2 - (n.x + NODE_W / 2) * k,
        y: size.h / 2.6 - (n.y + NODE_H / 2) * k,
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
      <svg width={size.w} height={size.h} style={{ display: "block" }}>
        <g
          transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}
          style={{ transition: animate ? "transform 0.5s cubic-bezier(0.16,1,0.3,1)" : "none" }}
        >
          {/* Links first (behind cards) */}
          <g className="tree-links">
            {layout.couples.map((c, i) => {
              const a = nodeById.get(c.a);
              const b = nodeById.get(c.b);
              if (!a || !b) return null;
              const y = a.y + NODE_H / 2;
              const x1 = Math.min(a.x, b.x) + NODE_W;
              const x2 = Math.max(a.x, b.x);
              return <line key={`c${i}`} className="link-couple" x1={x1} y1={y} x2={x2} y2={y} />;
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
              return (
                <path
                  key={`l${cl.child}`}
                  className="link-parent"
                  d={`M ${px} ${py} V ${midY} H ${cx} V ${cy}`}
                  fill="none"
                />
              );
            })}
          </g>

          {/* Cards */}
          {layout.nodes.map((n) => (
            <foreignObject key={n.id} x={n.x} y={n.y} width={NODE_W} height={NODE_H}>
              <TreeCard
                node={n}
                selected={n.id === active}
                sublabel={sublabel(n.person, t)}
                onClick={() => handleNodeClick(n.id)}
              />
            </foreignObject>
          ))}
        </g>
      </svg>
      )}
    </div>
  );
}

function TreeCard({
  node,
  selected,
  sublabel,
  onClick,
}: {
  node: LayoutNode;
  selected: boolean;
  sublabel: string;
  onClick: () => void;
}) {
  const p = node.person;
  const photo = mediaUrl(p.photo);
  const cls = [
    "tree-node",
    genderClass(p.gender),
    p.is_living ? "" : "deceased",
    selected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
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
