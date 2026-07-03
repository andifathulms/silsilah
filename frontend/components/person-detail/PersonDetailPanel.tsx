"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Person, Relatives } from "@/lib/types";

interface Props {
  treeId: number;
  person: Person;
  onRecenter?: (personId: number) => void;
}

function PeopleList({ label, people }: { label: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <div style={{ marginBottom: "0.6rem" }}>
      <div className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
        {label}
      </div>
      <div>{people.map((p) => p.name).join(", ")}</div>
    </div>
  );
}

/**
 * Compact panel shown alongside the tree. Derived relationships (siblings,
 * grandparents, …) come from the backend `/relatives/` endpoint — the panel
 * never recomputes the graph walk in the browser (CLAUDE.md).
 */
export default function PersonDetailPanel({ treeId, person, onRecenter }: Props) {
  const [relatives, setRelatives] = useState<Relatives | null>(null);

  useEffect(() => {
    setRelatives(null);
    api.getRelatives(treeId, person.id).then(setRelatives).catch(() => setRelatives(null));
  }, [treeId, person.id]);

  return (
    <div className="card" style={{ position: "sticky", top: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{person.name}</h3>
        {person.is_living ? (
          <span className="badge">living</span>
        ) : (
          <span className="badge">deceased</span>
        )}
      </div>

      {person._private_redacted && (
        <div className="muted" style={{ fontSize: "0.8rem", margin: "0.4rem 0" }}>
          🔒 Some details hidden (living person, viewer access)
        </div>
      )}

      <div className="muted" style={{ fontSize: "0.85rem", margin: "0.4rem 0 0.8rem" }}>
        {person.gender && <span>{person.gender} · </span>}
        {person.birth_date ? `b. ${person.birth_date}` : "birth unknown"}
        {person.death_date ? ` · d. ${person.death_date}` : ""}
      </div>

      {relatives ? (
        <>
          <PeopleList label="Parents" people={relatives.parents} />
          <PeopleList label="Spouses" people={relatives.spouses} />
          <PeopleList label="Children" people={relatives.children} />
          <PeopleList label="Full siblings" people={relatives.siblings_full} />
          <PeopleList label="Half siblings" people={relatives.siblings_half} />
          <PeopleList label="Grandparents" people={relatives.grandparents} />
        </>
      ) : (
        <p className="muted">Loading relatives…</p>
      )}

      <div className="row" style={{ marginTop: "0.8rem" }}>
        {onRecenter && (
          <button onClick={() => onRecenter(person.id)}>Center on this person</button>
        )}
        <Link href={`/trees/${treeId}/person/${person.id}`}>
          <button>Open full detail</button>
        </Link>
      </div>
    </div>
  );
}
