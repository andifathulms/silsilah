"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPublicShare, mediaUrl } from "@/lib/api";
import type { PublicPerson, PublicShare } from "@/lib/types";
import TreeView from "@/components/tree-view/TreeView";
import { useI18n } from "@/lib/i18n";
import LangToggle from "@/components/LangToggle";
import { genderLabel } from "@/components/person-detail/PersonDetailPanel";

/**
 * Anonymous, read-only view of a shared tree or branch. No auth: the token in
 * the URL is the capability. Living people are already redacted server-side.
 */
export default function PublicSharePage() {
  const params = useParams();
  const { t } = useI18n();
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
        <div className="error">{t("pub.invalidLink")}</div>
      </div>
    );
  if (!share) return <div className="container muted">{t("common.loading")}</div>;

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
            <LangToggle />
            <span className="badge">
              {t("pub.readonly")}{share.scope === "branch" ? t("pub.branch") : ""}
            </span>
            <a href="/login">
              <button className="primary sm">{t("pub.buildYours")}</button>
            </a>
          </div>
        </div>
      </header>
      <div className="container tree-container">
        <div className="share-hero animate-in">
          <div className="eyebrow">{t("pub.eyebrow")}</div>
          <h1 style={{ margin: "0.2rem 0 0.3rem" }}>{share.tree.name}</h1>
          <p className="muted" style={{ margin: 0 }}>{t("pub.explore")}</p>
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
              <div className="tree-hint">{t("tree.hint")}</div>
            )}
          </div>
          <aside className="detail-col">
            {selected ? (
              <ReadOnlyDetail person={selected} />
            ) : (
              <div className="card detail-empty">
                <div className="empty-mark" style={{ fontSize: "2rem" }}>👆</div>
                <p className="muted" style={{ margin: 0 }}>{t("pub.selectPerson")}</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="share-foot muted">
          {t("pub.madeWith")} <strong style={{ color: "var(--forest-600)" }}>🌳 Silsilah</strong> {t("pub.startFree")}
        </footer>
      </div>
    </>
  );
}

function ReadOnlyDetail({ person }: { person: PublicPerson }) {
  const { t } = useI18n();
  const initial = person.name.charAt(0).toUpperCase();
  return (
    <div className="card detail-card">
      <div className={`detail-banner ${person.is_living ? "living" : "deceased"}`} />
      <div className="detail-head">
        <div className="avatar detail-avatar">{initial}</div>
        <div style={{ minWidth: 0 }}>
          <h3 className="detail-name">{person.name}</h3>
          <div className="detail-sub">
            {person.gender && <span>{genderLabel(t, person.gender)} · </span>}
            {person.is_living ? t("person.living") : t("person.inMemory")}
            {person.birth_date ? ` · b. ${person.birth_date}` : ""}
            {person.death_date ? ` · d. ${person.death_date}` : ""}
          </div>
        </div>
      </div>
      {person._private_redacted && (
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>{t("pub.hidden")}</p>
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
