import type { Person, Relationship } from "./types";

// Card geometry (shared with the renderer).
export const NODE_W = 190;
export const NODE_H = 78;
const COUPLE_GAP = 14; // gap between spouses inside a couple
const BLOCK_GAP = 34; // gap between separate couples/singles in a row
const ROW_GAP = 76; // vertical gap between generations
const PAD = 48;

export interface LayoutNode {
  id: number;
  person: Person;
  x: number;
  y: number;
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

function push(map: Map<number, number[]>, k: number, v: number) {
  const a = map.get(k);
  if (!a) map.set(k, [v]);
  else if (!a.includes(v)) a.push(v);
}
function ensureSet(map: Map<number, Set<number>>, k: number): Set<number> {
  let s = map.get(k);
  if (!s) map.set(k, (s = new Set()));
  return s;
}

/**
 * A generation-aware layout that survives real pedigrees — including two
 * family branches joined by a marriage. People are grouped into "blocks"
 * (a couple + remarriages sit together), assigned to generation rows, ordered
 * to reduce crossings, then positioned by iterative barycenter with per-row
 * overlap resolution. Couples always stay adjacent; nobody is orphaned.
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
      push(childrenOf, r.person_a, r.person_b);
      push(parentsOf, r.person_b, r.person_a);
    } else if (r.type === "spouse") {
      if (!byId.has(r.person_a) || !byId.has(r.person_b)) continue;
      push(spousesOf, r.person_a, r.person_b);
      push(spousesOf, r.person_b, r.person_a);
    }
  }
  const ids = people.map((p) => p.id);
  if (ids.length === 0)
    return { nodes: [], couples: [], childLinks: [], width: 0, height: 0 };

  // --- 1. Generations (longest path from ancestors) ---
  const gen = new Map<number, number>();
  const visiting = new Set<number>();
  const baseGen = (id: number): number => {
    const c = gen.get(id);
    if (c !== undefined) return c;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let g = 0;
    for (const p of parentsOf.get(id) ?? []) if (p !== id) g = Math.max(g, baseGen(p) + 1);
    visiting.delete(id);
    gen.set(id, g);
    return g;
  };
  ids.forEach(baseGen);

  const spousePairs: [number, number][] = [];
  {
    const seen = new Set<string>();
    for (const r of relationships) {
      if (r.type !== "spouse" || !byId.has(r.person_a) || !byId.has(r.person_b)) continue;
      const k = [r.person_a, r.person_b].sort((a, b) => a - b).join("-");
      if (!seen.has(k)) {
        seen.add(k);
        spousePairs.push([r.person_a, r.person_b]);
      }
    }
  }
  // Align spouses onto the same row, then push children below — iterate to settle.
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const [a, b] of spousePairs) {
      const m = Math.max(gen.get(a)!, gen.get(b)!);
      if (gen.get(a)! !== m) (gen.set(a, m), (changed = true));
      if (gen.get(b)! !== m) (gen.set(b, m), (changed = true));
    }
    for (const id of ids) {
      const gi = gen.get(id)!;
      for (const c of childrenOf.get(id) ?? [])
        if (gen.get(c)! <= gi) (gen.set(c, gi + 1), (changed = true));
    }
    if (!changed) break;
  }

  // --- 2. Blocks: union same-generation spouses ---
  const uf = new Map<number, number>();
  ids.forEach((id) => uf.set(id, id));
  const find = (x: number): number => {
    let r = x;
    while (uf.get(r) !== r) r = uf.get(r)!;
    while (uf.get(x) !== r) {
      const n = uf.get(x)!;
      uf.set(x, r);
      x = n;
    }
    return r;
  };
  for (const [a, b] of spousePairs) if (gen.get(a) === gen.get(b)) uf.set(find(a), find(b));

  const blockMembersRaw = new Map<number, number[]>();
  for (const id of ids) {
    const b = find(id);
    const arr = blockMembersRaw.get(b);
    if (arr) arr.push(id);
    else blockMembersRaw.set(b, [id]);
  }
  // Order members inside a block so a multi-marriage "hub" sits in the middle.
  const orderMembers = (members: number[]): number[] => {
    if (members.length <= 2) return members;
    const set = new Set(members);
    const adj = new Map<number, number[]>();
    for (const m of members)
      adj.set(m, (spousesOf.get(m) ?? []).filter((s) => set.has(s)));
    let start = members.find((m) => adj.get(m)!.length === 1) ?? members[0];
    const out: number[] = [];
    const seen = new Set<number>();
    let cur: number | undefined = start;
    while (cur !== undefined && !seen.has(cur)) {
      out.push(cur);
      seen.add(cur);
      cur = adj.get(cur)!.find((x) => !seen.has(x));
    }
    for (const m of members) if (!seen.has(m)) out.push(m);
    return out;
  };
  const blockMembers = new Map<number, number[]>();
  for (const [b, mem] of blockMembersRaw) blockMembers.set(b, orderMembers(mem));

  const blockOf = new Map<number, number>();
  ids.forEach((id) => blockOf.set(id, find(id)));
  const blockGen = new Map<number, number>();
  for (const [b, mem] of blockMembers) blockGen.set(b, gen.get(mem[0])!);

  const blockChildren = new Map<number, Set<number>>();
  const blockParents = new Map<number, Set<number>>();
  for (const id of ids)
    for (const c of childrenOf.get(id) ?? []) {
      const pb = blockOf.get(id)!;
      const cb = blockOf.get(c)!;
      if (pb === cb) continue;
      ensureSet(blockChildren, pb).add(cb);
      ensureSet(blockParents, cb).add(pb);
    }

  // --- 3. Rows + initial order (DFS from root blocks) ---
  const maxGen = Math.max(...[...blockGen.values()]);
  const rows: number[][] = Array.from({ length: maxGen + 1 }, () => []);
  const seenOrder = new Set<number>();
  const dfs = (b: number) => {
    if (seenOrder.has(b)) return;
    seenOrder.add(b);
    rows[blockGen.get(b)!].push(b);
    for (const c of blockChildren.get(b) ?? []) dfs(c);
  };
  for (const b of blockMembers.keys()) if (!(blockParents.get(b)?.size)) dfs(b);
  for (const b of blockMembers.keys()) if (!seenOrder.has(b)) dfs(b);

  // --- 4. Ordering passes (barycenter reorder to cut crossings) ---
  const orderIndex = new Map<number, number>();
  const reindex = () => rows.forEach((row) => row.forEach((b, i) => orderIndex.set(b, i)));
  reindex();
  const bary = (b: number, up: boolean): number => {
    const set = up ? blockParents.get(b) : blockChildren.get(b);
    if (!set || !set.size) return orderIndex.get(b)!;
    let s = 0;
    for (const n of set) s += orderIndex.get(n)!;
    return s / set.size;
  };
  for (let pass = 0; pass < 8; pass++) {
    const up = pass % 2 === 0;
    for (let g = 0; g <= maxGen; g++)
      rows[g] = rows[g]
        .map((b) => ({ b, k: bary(b, up) }))
        .sort((x, y) => x.k - y.k)
        .map((o) => o.b);
    reindex();
  }

  // --- 5. X by iterative barycenter with per-row overlap resolution ---
  const blockWidth = (b: number) => {
    const n = blockMembers.get(b)!.length;
    return n * NODE_W + (n - 1) * COUPLE_GAP;
  };
  const center = new Map<number, number>();
  for (let g = 0; g <= maxGen; g++) {
    let x = 0;
    for (const b of rows[g]) {
      const w = blockWidth(b);
      center.set(b, x + w / 2);
      x += w + BLOCK_GAP;
    }
  }
  for (let iter = 0; iter < 70; iter++) {
    const desired = new Map<number, number>();
    for (const b of blockMembers.keys()) {
      const ns: number[] = [];
      for (const n of blockParents.get(b) ?? []) ns.push(center.get(n)!);
      for (const n of blockChildren.get(b) ?? []) ns.push(center.get(n)!);
      desired.set(b, ns.length ? ns.reduce((a, c) => a + c, 0) / ns.length : center.get(b)!);
    }
    for (let g = 0; g <= maxGen; g++) {
      let prevRight = -Infinity;
      for (const b of rows[g]) {
        const w = blockWidth(b);
        let c = desired.get(b)!;
        if (c - w / 2 < prevRight + BLOCK_GAP) c = prevRight + BLOCK_GAP + w / 2;
        center.set(b, c);
        prevRight = c + w / 2;
      }
    }
  }

  // --- 6. Positions ---
  const pos = new Map<number, { x: number; y: number }>();
  for (const [b, mem] of blockMembers) {
    const w = blockWidth(b);
    let mx = center.get(b)! - w / 2;
    const y = blockGen.get(b)! * (NODE_H + ROW_GAP);
    for (const id of mem) {
      pos.set(id, { x: mx, y });
      mx += NODE_W + COUPLE_GAP;
    }
  }

  const nodes: LayoutNode[] = people
    .filter((p) => pos.has(p.id))
    .map((p) => ({ id: p.id, person: p, x: pos.get(p.id)!.x, y: pos.get(p.id)!.y }));

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  for (const n of nodes) {
    n.x = n.x - minX + PAD;
    n.y = n.y - minY + PAD;
  }
  const width = Math.max(...nodes.map((n) => n.x + NODE_W)) + PAD;
  const height = Math.max(...nodes.map((n) => n.y + NODE_H)) + PAD;

  const couples: CoupleLink[] = [];
  {
    const seen = new Set<string>();
    for (const [a, b] of spousePairs) {
      if (!pos.has(a) || !pos.has(b)) continue;
      const k = [a, b].sort((x, y) => x - y).join("-");
      if (!seen.has(k)) {
        seen.add(k);
        couples.push({ a, b });
      }
    }
  }
  const childLinks: ChildLink[] = [];
  for (const p of people) {
    const par = (parentsOf.get(p.id) ?? []).filter((id) => pos.has(id));
    if (par.length && pos.has(p.id)) childLinks.push({ child: p.id, parents: par });
  }

  return { nodes, couples, childLinks, width, height };
}
