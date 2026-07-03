"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api";
import type { Person, Relatives } from "@/lib/types";

interface Props {
  treeId: number;
  person: Person;
  onRecenter?: (personId: number) => void;
}

function RelativeRow({ label, people }: { label: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <div className="rel-row">
      <span className="rel-label">{label}</span>
      <span className="rel-people">{people.map((p) => p.name).join(", ")}</span>
    </div>
  );
}

/**
 * Compact, elegant panel shown alongside the tree. Derived relationships come
 * from the backend `/relatives/` endpoint — never recomputed in the browser.
 */
export default function PersonDetailPanel({ treeId, person, onRecenter }: Props) {
  const [relatives, setRelatives] = useState<Relatives | null>(null);

  useEffect(() => {
    setRelatives(null);
    api.getRelatives(treeId, person.id).then(setRelatives).catch(() => setRelatives(null));
  }, [treeId, person.id]);

  const initial = person.name.charAt(0).toUpperCase();
  const photo = mediaUrl(person.photo);
  const lifespan = [person.birth_date?.slice(0, 4), person.death_date?.slice(0, 4)];
  const hasLifespan = lifespan[0] || lifespan[1];

  return (
    <div className="card detail-card">
      <div className={`detail-banner ${person.is_living ? "living" : "deceased"}`} />
      <div className="detail-head">
        <div className="avatar detail-avatar">
          {photo ? <img src={photo} alt={person.name} /> : initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="detail-name">{person.name}</h3>
          <div className="detail-sub">
            {person.gender && <span>{titleCase(person.gender)}</span>}
            {person.gender && hasLifespan && <span> · </span>}
            {hasLifespan && (
              <span>
                {lifespan[0] ?? "?"}
                {person.death_date ? `–${lifespan[1]}` : person.is_living ? "" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: "0.4rem", marginBottom: "0.85rem" }}>
        <span className={`badge ${person.is_living ? "forest" : ""}`}>
          {person.is_living ? "● Living" : "In memory"}
        </span>
        {person._private_redacted && <span className="badge">🔒 Private</span>}
      </div>

      {person._private_redacted && (
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
          Some details are hidden for living relatives at your access level.
        </p>
      )}

      {relatives ? (
        <div className="rel-list">
          <RelativeRow label="Parents" people={relatives.parents} />
          <RelativeRow label="Spouses" people={relatives.spouses} />
          <RelativeRow label="Children" people={relatives.children} />
          <RelativeRow label="Full siblings" people={relatives.siblings_full} />
          <RelativeRow label="Half siblings" people={relatives.siblings_half} />
          <RelativeRow label="Grandparents" people={relatives.grandparents} />
          {isEmpty(relatives) && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No relationships yet — connect this person to others.
            </p>
          )}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: "0.85rem" }}>Loading relatives…</p>
      )}

      <div className="detail-actions">
        {onRecenter && (
          <button className="sm" onClick={() => onRecenter(person.id)}>
            🎯 Center here
          </button>
        )}
        <Link href={`/trees/${treeId}/person/${person.id}`} style={{ flex: 1 }}>
          <button className="primary sm" style={{ width: "100%" }}>
            View full profile →
          </button>
        </Link>
      </div>
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isEmpty(r: Relatives) {
  return (
    r.parents.length +
      r.spouses.length +
      r.children.length +
      r.siblings_full.length +
      r.siblings_half.length +
      r.grandparents.length ===
    0
  );
}
