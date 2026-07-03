import type { Person, Relationship } from "./types";

/**
 * `family-chart` expects each datum shaped as:
 *   { id, data: { "first name", "last name", gender, avatar, ... },
 *     rels: { father, mother, spouses: [], children: [] } }
 *
 * Our backend stores generic Relationship edges instead. This adapter is the
 * thin transform between the two (CLAUDE.md: adapt to the library, don't
 * contort the Django models). It runs on read only.
 */

export interface FamilyChartDatum {
  id: string;
  data: {
    "first name": string;
    "last name": string;
    gender: "M" | "F";
    avatar?: string;
    birthday?: string;
    _living: boolean;
    _redacted: boolean;
  };
  rels: {
    father?: string;
    mother?: string;
    spouses?: string[];
    children?: string[];
  };
}

function toGenderCode(gender: string): "M" | "F" {
  const g = (gender || "").toLowerCase();
  if (g.startsWith("f") || g.startsWith("w")) return "F";
  return "M";
}

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

/** Human-friendly lifespan for a node label. Deceased people get a dagger (†)
 * and always show a line ("in memory" when no dates) so they read as departed
 * even without a birth/death year. Avoids raw ISO dates on the card. */
function lifespanLabel(p: Person): string | undefined {
  const b = p.birth_date ? p.birth_date.slice(0, 4) : "";
  const d = p.death_date ? p.death_date.slice(0, 4) : "";
  if (!p.is_living) {
    if (b && d) return `† ${b} – ${d}`;
    if (d) return `† d. ${d}`;
    if (b) return `† b. ${b}`;
    return "† in memory";
  }
  if (b) return `b. ${b}`;
  return undefined;
}

export function toFamilyChartData(
  people: Person[],
  relationships: Relationship[]
): FamilyChartDatum[] {
  const byId = new Map<number, Person>();
  people.forEach((p) => byId.set(p.id, p));

  const data: Map<string, FamilyChartDatum> = new Map();
  for (const p of people) {
    const [first, last] = splitName(p.name);
    data.set(String(p.id), {
      id: String(p.id),
      data: {
        "first name": first,
        "last name": last,
        gender: toGenderCode(p.gender),
        avatar: p.photo || undefined,
        birthday: lifespanLabel(p),
        _living: p.is_living,
        _redacted: Boolean(p._private_redacted),
      },
      rels: { spouses: [], children: [] },
    });
  }

  for (const rel of relationships) {
    const a = data.get(String(rel.person_a));
    const b = data.get(String(rel.person_b));
    if (!a || !b) continue;

    if (rel.type === "spouse") {
      a.rels.spouses = a.rels.spouses || [];
      b.rels.spouses = b.rels.spouses || [];
      if (!a.rels.spouses.includes(b.id)) a.rels.spouses.push(b.id);
      if (!b.rels.spouses.includes(a.id)) b.rels.spouses.push(a.id);
    } else if (rel.type === "parent_child") {
      // person_a = parent, person_b = child
      a.rels.children = a.rels.children || [];
      if (!a.rels.children.includes(b.id)) a.rels.children.push(b.id);

      // Assign father/mother slot on the child by parent gender, falling back
      // to whichever slot is free (handles same-gender / unknown parents).
      const parentPerson = byId.get(rel.person_a);
      const gender = toGenderCode(parentPerson?.gender || "");
      if (gender === "M" && !b.rels.father) b.rels.father = a.id;
      else if (gender === "F" && !b.rels.mother) b.rels.mother = a.id;
      else if (!b.rels.father) b.rels.father = a.id;
      else if (!b.rels.mother) b.rels.mother = a.id;
    }
  }

  return Array.from(data.values());
}
