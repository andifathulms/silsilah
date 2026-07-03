"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPublicShare, mediaUrl } from "@/lib/api";
import type { PublicPerson, PublicShare } from "@/lib/types";
import TreeView from "@/components/tree-view/TreeView";

/**
 * Anonymous, read-only view of a shared tree or branch. No auth: the token in
 * the URL is the capability. Living people are already redacted server-side.
 */
export default function PublicSharePage() {
  const params = useParams();
  const token = String(params.token);

  const [share, setShare] = useState<PublicShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchPublicShare(token)
      .then((s) => {
        setShare(s);
        if (s.people.length) setSelectedId(s.people[0].id);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error)
    return (
      <div className="container">
        <div className="error">This share link is invalid or has been revoked.</div>
      </div>
    );
  if (!share) return <div className="container muted">Loading…</div>;

  const selected: PublicPerson | null =
    share.people.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      <div className="topbar">
        <span className="brand">🌳 {share.tree.name}</span>
        <span className="badge">
          read-only{share.scope === "branch" ? " · branch" : ""}
        </span>
      </div>
      <div className="container" style={{ maxWidth: 1200 }}>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Shared family tree. Details of living people are hidden for privacy.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          <div style={{ height: "72vh" }}>
            <TreeView
              people={share.people}
              relationships={share.relationships}
              mainId={share.root_person}
              onSelect={setSelectedId}
            />
          </div>
          <div>
            {selected ? (
              <ReadOnlyDetail person={selected} />
            ) : (
              <div className="card muted">Select a person.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ReadOnlyDetail({ person }: { person: PublicPerson }) {
  return (
    <div className="card" style={{ position: "sticky", top: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>{person.name}</h3>
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        {person.gender && <span>{person.gender} · </span>}
        {person.is_living ? "living" : "deceased"}
        {person.birth_date ? ` · b. ${person.birth_date}` : ""}
        {person.death_date ? ` · d. ${person.death_date}` : ""}
      </div>
      {person._private_redacted && (
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          🔒 Details hidden (living person).
        </p>
      )}
      {person.notes && <p style={{ whiteSpace: "pre-wrap" }}>{person.notes}</p>}
      {person.media.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: "0.4rem",
            marginTop: "0.6rem",
          }}
        >
          {person.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={mediaUrl(m.image) ?? ""}
              alt={m.caption || "photo"}
              title={m.caption}
              style={{
                width: "100%",
                height: 70,
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
