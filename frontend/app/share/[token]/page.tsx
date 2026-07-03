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
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">🌳</span> {share.tree.name}
          </span>
          <div className="row">
            <span className="badge">
              👁 Read-only{share.scope === "branch" ? " · branch" : ""}
            </span>
            <a href="/login">
              <button className="primary sm">Build your own →</button>
            </a>
          </div>
        </div>
      </header>
      <div className="container tree-container">
        <div className="share-hero animate-in">
          <div className="eyebrow">A shared family tree</div>
          <h1 style={{ margin: "0.2rem 0 0.3rem" }}>{share.tree.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Explore the family below. Details of living relatives are kept private.
          </p>
        </div>

        <div className="tree-layout animate-in d1">
          <div className="tree-stage">
            <TreeView
              people={share.people}
              relationships={share.relationships}
              mainId={share.root_person}
              onSelect={setSelectedId}
            />
            {share.people.length > 0 && (
              <div className="tree-hint">Click a person · drag to pan · scroll to zoom</div>
            )}
          </div>
          <aside className="detail-col">
            {selected ? (
              <ReadOnlyDetail person={selected} />
            ) : (
              <div className="card detail-empty">
                <div className="empty-mark" style={{ fontSize: "2rem" }}>👆</div>
                <p className="muted" style={{ margin: 0 }}>Select a person to see details.</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="share-foot muted">
          Made with <strong style={{ color: "var(--forest-600)" }}>🌳 Silsilah</strong> — start your family's tree free.
        </footer>
      </div>
    </>
  );
}

function ReadOnlyDetail({ person }: { person: PublicPerson }) {
  const initial = person.name.charAt(0).toUpperCase();
  return (
    <div className="card detail-card">
      <div className={`detail-banner ${person.is_living ? "living" : "deceased"}`} />
      <div className="detail-head">
        <div className="avatar detail-avatar">{initial}</div>
        <div style={{ minWidth: 0 }}>
          <h3 className="detail-name">{person.name}</h3>
          <div className="detail-sub">
            {person.gender && <span>{titleCase(person.gender)} · </span>}
            {person.is_living ? "Living" : "In memory"}
            {person.birth_date ? ` · b. ${person.birth_date}` : ""}
            {person.death_date ? ` · d. ${person.death_date}` : ""}
          </div>
        </div>
      </div>
      {person._private_redacted && (
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
          🔒 Details hidden for this living relative.
        </p>
      )}
      {person.notes && <p style={{ whiteSpace: "pre-wrap" }}>{person.notes}</p>}
      {person.media.length > 0 && (
        <div className="media-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
          {person.media.map((m) => (
            <figure key={m.id} className="media-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(m.image) ?? ""} alt={m.caption || "photo"} title={m.caption} style={{ height: 78 }} />
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
