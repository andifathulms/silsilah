"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Person } from "@/lib/types";
import PersonForm from "@/components/person-form/PersonForm";

export type RelativeKind = "parent" | "child" | "spouse" | "sibling";

interface Props {
  treeId: number;
  anchor: Person;
  kind: RelativeKind;
  onDone: (createdId: number) => void;
  onCancel: () => void;
}

const LABELS: Record<RelativeKind, string> = {
  parent: "parent",
  child: "child",
  spouse: "spouse",
  sibling: "sibling",
};

/**
 * Add a new person AND connect them in a single flow (PRD #11), keeping the
 * tree lines correct:
 *  - child   → linked to the anchor and (optionally) the anchor's spouse(s)
 *  - sibling → linked to the anchor's parents, so they share a couple
 *  - parent/spouse → single edge
 */
export default function AddRelativeForm({ treeId, anchor, kind, onDone, onCancel }: Props) {
  // Co-parents for a child (the anchor's spouses); parents for a sibling.
  const [spouses, setSpouses] = useState<Person[]>([]);
  const [parents, setParents] = useState<Person[]>([]);
  const [coParentIds, setCoParentIds] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(kind === "parent" || kind === "spouse");

  useEffect(() => {
    if (kind === "child" || kind === "sibling") {
      api
        .getRelatives(treeId, anchor.id)
        .then((r) => {
          setSpouses(r.spouses);
          setParents(r.parents);
          // Default: co-parent with all current spouses.
          setCoParentIds(new Set(r.spouses.map((s) => s.id)));
          setReady(true);
        })
        .catch(() => setReady(true));
    }
  }, [treeId, anchor.id, kind]);

  function toggleCoParent(id: number) {
    setCoParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function link(type: "parent_child" | "spouse", a: number, b: number) {
    await api.createRelationship(treeId, { type, person_a: a, person_b: b });
  }

  async function handleSubmit(values: Parameters<typeof api.createPerson>[1]) {
    const created = await api.createPerson(treeId, {
      ...values,
      birth_date: (values.birth_date as string) || null,
      death_date: (values.death_date as string) || null,
    });

    if (kind === "spouse") {
      await link("spouse", anchor.id, created.id);
    } else if (kind === "parent") {
      await link("parent_child", created.id, anchor.id);
    } else if (kind === "child") {
      await link("parent_child", anchor.id, created.id);
      for (const spouseId of coParentIds) {
        await link("parent_child", spouseId, created.id);
      }
    } else if (kind === "sibling") {
      // Share the anchor's parents so both hang from the same couple.
      for (const parent of parents) {
        await link("parent_child", parent.id, created.id);
      }
    }
    onDone(created.id);
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
        Adding a <strong>{LABELS[kind]}</strong> of <strong>{anchor.name}</strong>.
      </p>

      {kind === "child" && spouses.length > 0 && (
        <div className="coparent-box">
          <div className="rel-label" style={{ marginBottom: "0.4rem" }}>Also a child of</div>
          {spouses.map((s) => (
            <label key={s.id} className="check" style={{ marginBottom: "0.3rem" }}>
              <input
                type="checkbox"
                checked={coParentIds.has(s.id)}
                onChange={() => toggleCoParent(s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
      )}

      {kind === "sibling" && (
        <div className="coparent-box">
          {parents.length > 0 ? (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Will be connected to the same parent{parents.length > 1 ? "s" : ""}:{" "}
              <strong>{parents.map((p) => p.name).join(" & ")}</strong>.
            </span>
          ) : (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              ⚠️ {anchor.name} has no parents recorded yet, so this sibling won't be
              connected automatically. Add a parent first for the link to form.
            </span>
          )}
        </div>
      )}

      {ready ? (
        <PersonForm submitLabel={`Add ${LABELS[kind]}`} onSubmit={handleSubmit} onCancel={onCancel} />
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}
