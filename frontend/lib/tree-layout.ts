import type { Person, Relationship } from "./types";

// Card geometry (shared with the renderer).
export const NODE_W = 190;
export const NODE_H = 78;
const COUPLE_GAP = 16; // gap between spouses in a couple
const SIB_GAP = 30; // gap between sibling subtrees
const ROW_GAP = 78; // vertical gap between generations
const PAD = 48; // padding around the whole tree

export interface LayoutNode {
  id: number;
  person: Person;
  x: number; // left of card
  y: number; // top of card
}
export interface CoupleLink {
  a: number;
  b: number;
}
export interface ChildLink {
  child: number;
  parents: number[];
}
export interface TreeLayout {
  nodes: LayoutNode[];
  couples: CoupleLink[];
  childLinks: ChildLink[];
  width: number;
  height: number;
}

function pushUnique(map: Map<number, number[]>, key: number, val: number) {
  const arr = map.get(key);
  if (!arr) map.set(key, [val]);
  else if (!arr.includes(val)) arr.push(val);
}

/**
 * A self-contained genealogy layout: a top-down descendant tree where couples
 * sit side-by-side and children hang centered beneath them. Leaves are packed
 * left-to-right (no overlap); internal couples are centered over their
 * children — the classic tidy-tree shape, tuned for family structures
 * (remarriage, shared children, married-in spouses).
 */
export function computeTreeLayout(
  people: Person[],
  relationships: Relationship[]
): TreeLayout {
  const byId = new Map(people.map((p) => [p.id, p]));

  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  const spousesOf = new Map<number, number[]>();

  for (const r of relationships) {
    if (r.type === "parent_child") {
      if (!byId.has(r.person_a) || !byId.has(r.person_b)) continue;
      pushUnique(childrenOf, r.person_a, r.person_b);
      pushUnique(parentsOf, r.person_b, r.person_a);
    } else if (r.type === "spouse") {
      if (!byId.has(r.person_a) || !byId.has(r.person_b)) continue;
      pushUnique(spousesOf, r.person_a, r.person_b);
      pushUnique(spousesOf, r.person_b, r.person_a);
    }
  }

  const placed = new Set<number>();
  const pos = new Map<number, { x: number; y: number }>();
  let cursorX = 0;

  function assign(rootId: number, depth: number): number {
    placed.add(rootId);
    const spouses = (spousesOf.get(rootId) ?? []).filter(
      (s) => !placed.has(s) && byId.has(s)
    );
    const members = [rootId, ...spouses];
    members.forEach((m) => placed.add(m));

    const coupleWidth =
      members.length * NODE_W + (members.length - 1) * COUPLE_GAP;

    // Children of anyone in the couple, not yet placed.
    const kidSet = new Set<number>();
    for (const m of members)
      for (const c of childrenOf.get(m) ?? [])
        if (!placed.has(c) && byId.has(c)) kidSet.add(c);
    const kids = [...kidSet];

    let center: number;
    if (kids.length === 0) {
      center = cursorX + coupleWidth / 2;
      cursorX += coupleWidth + SIB_GAP;
    } else {
      const childCenters = kids.map((k) => assign(k, depth + 1));
      const first = childCenters[0];
      const last = childCenters[childCenters.length - 1];
      center = (first + last) / 2;
      // Keep the couple from colliding leftward with an earlier subtree.
      const leftEdge = center - coupleWidth / 2;
      if (leftEdge < cursorX - coupleWidth) {
        const shift = cursorX - coupleWidth - leftEdge;
        center += shift;
      }
      cursorX = Math.max(cursorX, center + coupleWidth / 2 + SIB_GAP);
    }

    const y = depth * (NODE_H + ROW_GAP);
    let mx = center - coupleWidth / 2;
    for (const m of members) {
      pos.set(m, { x: mx, y });
      mx += NODE_W + COUPLE_GAP;
    }
    return center;
  }

  // Roots = people with no parents. Married-in spouses get placed as part of a
  // couple; the `placed` set stops them from starting a second subtree.
  const roots = people.filter((p) => !(parentsOf.get(p.id)?.length));
  for (const r of roots) if (!placed.has(r.id)) assign(r.id, 0);
  // Anyone left (disconnected or data cycles) still gets a spot.
  for (const p of people) if (!placed.has(p.id)) assign(p.id, 0);

  const nodes: LayoutNode[] = people
    .filter((p) => pos.has(p.id))
    .map((p) => ({ id: p.id, person: p, x: pos.get(p.id)!.x, y: pos.get(p.id)!.y }));

  if (nodes.length === 0) {
    return { nodes: [], couples: [], childLinks: [], width: 0, height: 0 };
  }

  // Normalize to a (0,0)-origin canvas with padding.
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  for (const n of nodes) {
    n.x = n.x - minX + PAD;
    n.y = n.y - minY + PAD;
  }
  const width = Math.max(...nodes.map((n) => n.x + NODE_W)) + PAD;
  const height = Math.max(...nodes.map((n) => n.y + NODE_H)) + PAD;

  const couples: CoupleLink[] = [];
  const seen = new Set<string>();
  for (const r of relationships) {
    if (r.type !== "spouse") continue;
    if (!pos.has(r.person_a) || !pos.has(r.person_b)) continue;
    const key = [r.person_a, r.person_b].sort((a, b) => a - b).join("-");
    if (!seen.has(key)) {
      seen.add(key);
      couples.push({ a: r.person_a, b: r.person_b });
    }
  }

  const childLinks: ChildLink[] = [];
  for (const p of people) {
    const par = (parentsOf.get(p.id) ?? []).filter((id) => pos.has(id));
    if (par.length && pos.has(p.id)) childLinks.push({ child: p.id, parents: par });
  }

  return { nodes, couples, childLinks, width, height };
}
