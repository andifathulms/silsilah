"use client";

import { api } from "@/lib/api";
import type { Person } from "@/lib/types";
import PersonForm from "@/components/person-form/PersonForm";

export type RelativeKind = "parent" | "child" | "spouse";

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
};

/**
 * Add a new person AND connect them to an existing one in a single flow
 * (PRD #11). Creates the Person, then the correctly-directed Relationship.
 */
export default function AddRelativeForm({ treeId, anchor, kind, onDone, onCancel }: Props) {
  async function handleSubmit(values: Parameters<typeof api.createPerson>[1]) {
    const created = await api.createPerson(treeId, {
      ...values,
      birth_date: (values.birth_date as string) || null,
      death_date: (values.death_date as string) || null,
    });

    if (kind === "spouse") {
      await api.createRelationship(treeId, {
        type: "spouse",
        person_a: anchor.id,
        person_b: created.id,
      });
    } else if (kind === "parent") {
      // new person is the parent of the anchor
      await api.createRelationship(treeId, {
        type: "parent_child",
        person_a: created.id,
        person_b: anchor.id,
      });
    } else {
      // new person is the child of the anchor
      await api.createRelationship(treeId, {
        type: "parent_child",
        person_a: anchor.id,
        person_b: created.id,
      });
    }
    onDone(created.id);
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
        Adding a <strong>{LABELS[kind]}</strong> of <strong>{anchor.name}</strong>.
      </p>
      <PersonForm submitLabel={`Add ${LABELS[kind]}`} onSubmit={handleSubmit} onCancel={onCancel} />
    </div>
  );
}
