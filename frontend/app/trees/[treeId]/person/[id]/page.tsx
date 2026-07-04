"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, mediaUrl } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { ChangeLogEntry, Person, Relatives, Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";
import PersonForm from "@/components/person-form/PersonForm";
import MediaGallery from "@/components/media/MediaGallery";
import RelationshipCalculator from "@/components/relationship-calculator/RelationshipCalculator";
import LifeTimeline from "@/components/timeline/LifeTimeline";
import Comments from "@/components/comments/Comments";
import { useI18n } from "@/lib/i18n";
import { genderLabel } from "@/components/person-detail/PersonDetailPanel";

const FIELD_KEYS: Record<string, string> = {
  name: "form.name",
  gender: "form.gender",
  birth_date: "form.birthDate",
  death_date: "form.deathDate",
  is_living: "form.living",
  notes: "form.notes",
};

function ChangeLog({ entries }: { entries: ChangeLogEntry[] }) {
  const { t } = useI18n();
  if (!entries.length)
    return <p className="muted" style={{ margin: 0 }}>{t("person.noRelationships")}</p>;
  return (
    <div className="timeline">
      {entries.map((e) => (
        <div key={e.id} className="timeline-item">
          <div className="timeline-dot" />
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              <strong style={{ color: "var(--ink-soft)" }}>
                {e.changed_by_username ?? "—"}
              </strong>{" "}
              · {new Date(e.changed_at).toLocaleString()}
            </div>
            <ul className="diff-list">
              {Object.entries(e.diff).map(([field, [oldV, newV]]) => (
                <li key={field}>
                  <span className="diff-field">{FIELD_KEYS[field] ? t(FIELD_KEYS[field]).replace(" *", "") : field}</span>
                  <span className="diff-old">{String(oldV ?? "—")}</span>
                  <span className="diff-arrow">→</span>
                  <span className="diff-new">{String(newV ?? "—")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const treeId = Number(params.treeId);
  const personId = Number(params.id);

  const [tree, setTree] = useState<Tree | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [relatives, setRelatives] = useState<Relatives | null>(null);
  const [changelog, setChangelog] = useState<ChangeLogEntry[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = tree?.my_role === "owner" || tree?.my_role === "editor";

  const load = useCallback(async () => {
    try {
      const [tr, p, r] = await Promise.all([
        api.getTree(treeId),
        api.getPerson(treeId, personId),
        api.getRelatives(treeId, personId),
      ]);
      setTree(tr);
      setPerson(p);
      setRelatives(r);
      if (tr.my_role === "owner" || tr.my_role === "editor") {
        api.getChangelog(treeId, personId).then(setChangelog).catch(() => setChangelog([]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load person");
    }
  }, [treeId, personId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  async function archive() {
    if (!confirm(t("person.archiveConfirm", { name: person?.name ?? "" }))) return;
    await api.archivePerson(treeId, personId);
    router.push(`/trees/${treeId}`);
  }

  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!person)
    return (
      <>
        <TopBar />
        <div className="container muted">{t("common.loading")}</div>
      </>
    );

  const initial = person.name.charAt(0).toUpperCase();
  const photo = mediaUrl(person.photo);
  const lifespan = [person.birth_date?.slice(0, 4), person.death_date?.slice(0, 4)];

  return (
    <>
      <TopBar />
      <div className="container">
        <nav className="crumbs animate-in">
          <Link href="/">{t("tree.crumbMyTrees")}</Link>
          <span className="muted">/</span>
          <Link href={`/trees/${treeId}`}>{tree?.name ?? "Tree"}</Link>
          <span className="muted">/</span>
          <span className="muted">{person.name}</span>
        </nav>

        {/* Profile hero */}
        <div className="profile-hero animate-in d1">
          <div className={`profile-hero-bg ${person.is_living ? "" : "deceased"}`} />
          <div className="profile-hero-content">
            <div className="avatar profile-avatar">
              {photo ? <img src={photo} alt={person.name} /> : initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, color: "#fff" }}>{person.name}</h1>
              <div className="row wrap" style={{ gap: "0.4rem", marginTop: "0.5rem" }}>
                <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                  {person.is_living ? `● ${t("person.living")}` : t("person.inMemory")}
                </span>
                {person.gender && (
                  <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {genderLabel(t, person.gender)}
                  </span>
                )}
                {(lifespan[0] || lifespan[1]) && (
                  <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {lifespan[0] ?? "?"}{person.death_date ? `–${lifespan[1]}` : ""}
                  </span>
                )}
              </div>
            </div>
            {canEdit && !editing && (
              <div className="row profile-actions">
                <button onClick={() => setEditing(true)}>✎ {t("person.edit")}</button>
                <button className="danger" onClick={archive}>{t("person.archive")}</button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-grid animate-in d2">
          <div className="card">
            {editing ? (
              <>
                <h3 style={{ marginTop: 0 }}>{t("person.editDetails")}</h3>
                <PersonForm
                  initial={person}
                  submitLabel={t("person.saveChanges")}
                  onCancel={() => setEditing(false)}
                  onSubmit={async (values) => {
                    await api.updatePerson(treeId, personId, {
                      ...values,
                      birth_date: values.birth_date || null,
                      death_date: values.death_date || null,
                    });
                    setEditing(false);
                    await load();
                  }}
                />
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{t("person.details")}</h3>
                {person._private_redacted && (
                  <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
                    🔒 {t("person.privacyHidden")}
                  </p>
                )}
                <dl className="detail-dl">
                  <dt>{t("form.gender")}</dt><dd>{person.gender ? genderLabel(t, person.gender) : "—"}</dd>
                  <dt>{t("person.born")}</dt><dd>{person.birth_date || "—"}</dd>
                  <dt>{t("person.died")}</dt><dd>{person.death_date || "—"}</dd>
                  <dt>{t("person.status")}</dt><dd>{person.is_living ? t("person.living") : t("person.deceased")}</dd>
                </dl>
                {person.notes && (
                  <>
                    <h4 style={{ marginBottom: "0.4rem" }}>{t("person.notes")}</h4>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{person.notes}</p>
                  </>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("person.family")}</h3>
            {relatives ? (
              <RelativeLinks treeId={treeId} relatives={relatives} />
            ) : (
              <p className="muted">{t("common.loading")}</p>
            )}
            <div className="divider" />
            <h4 style={{ margin: "0 0 0.6rem" }}>🧮 {t("person.relCalc")}</h4>
            <RelationshipCalculator treeId={treeId} person={person} />
          </div>
        </div>

        <div className="card animate-in d3" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>🕰 {t("person.timeline")}</h3>
          <LifeTimeline
            treeId={treeId}
            person={person}
            canEdit={canEdit}
            redacted={person._private_redacted}
          />
        </div>

        <div className="card animate-in d3" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>📷 {t("person.photos")}</h3>
          <MediaGallery
            treeId={treeId}
            personId={personId}
            canEdit={canEdit}
            redacted={person._private_redacted}
          />
        </div>

        <div className="card animate-in d4" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>💬 {t("person.stories")}</h3>
          <Comments treeId={treeId} personId={personId} personName={person.name} canPost={canEdit} />
        </div>

        {canEdit && (
          <div className="card animate-in d4" style={{ marginTop: "1.25rem" }}>
            <h3 style={{ marginTop: 0 }}>🕓 {t("person.changeHistory")}</h3>
            {changelog ? <ChangeLog entries={changelog} /> : <p className="muted">{t("common.loading")}</p>}
          </div>
        )}
      </div>
    </>
  );
}

function RelativeLinks({ treeId, relatives }: { treeId: number; relatives: Relatives }) {
  const { t } = useI18n();
  const groups: [string, Person[]][] = [
    [t("panel.parents"), relatives.parents],
    [t("panel.spouses"), relatives.spouses],
    [t("panel.children"), relatives.children],
    [t("panel.fullSiblings"), relatives.siblings_full],
    [t("panel.halfSiblings"), relatives.siblings_half],
    [t("panel.grandparents"), relatives.grandparents],
  ];
  const anyRelatives = groups.some(([, list]) => list.length > 0);
  if (!anyRelatives)
    return <p className="muted" style={{ margin: 0 }}>{t("person.noRelationships")}</p>;
  return (
    <div className="rel-list" style={{ borderTop: "none", paddingTop: 0 }}>
      {groups.map(([label, list]) =>
        list.length ? (
          <div key={label} className="rel-row">
            <span className="rel-label">{label}</span>
            <span className="rel-people">
              {list.map((p, i) => (
                <span key={p.id}>
                  <Link href={`/trees/${treeId}/person/${p.id}`}>{p.name}</Link>
                  {i < list.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}
