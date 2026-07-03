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

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  gender: "Gender",
  birth_date: "Birth date",
  death_date: "Death date",
  is_living: "Living",
  notes: "Notes",
  is_archived: "Archived",
  photo: "Photo",
};

function ChangeLog({ entries }: { entries: ChangeLogEntry[] }) {
  if (!entries.length)
    return <p className="muted" style={{ margin: 0 }}>No changes recorded yet.</p>;
  return (
    <div className="timeline">
      {entries.map((e) => (
        <div key={e.id} className="timeline-item">
          <div className="timeline-dot" />
          <div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              <strong style={{ color: "var(--ink-soft)" }}>
                {e.changed_by_username ?? "Someone"}
              </strong>{" "}
              · {new Date(e.changed_at).toLocaleString()}
            </div>
            <ul className="diff-list">
              {Object.entries(e.diff).map(([field, [oldV, newV]]) => (
                <li key={field}>
                  <span className="diff-field">{FIELD_LABELS[field] ?? field}</span>
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
      const [t, p, r] = await Promise.all([
        api.getTree(treeId),
        api.getPerson(treeId, personId),
        api.getRelatives(treeId, personId),
      ]);
      setTree(t);
      setPerson(p);
      setRelatives(r);
      if (t.my_role === "owner" || t.my_role === "editor") {
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
    if (!confirm(`Archive ${person?.name}? They'll be hidden from the tree.`)) return;
    await api.archivePerson(treeId, personId);
    router.push(`/trees/${treeId}`);
  }

  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!person)
    return (
      <>
        <TopBar />
        <div className="container muted">Loading…</div>
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
          <Link href="/">My trees</Link>
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
                  {person.is_living ? "● Living" : "In memory"}
                </span>
                {person.gender && (
                  <span className="badge" style={{ background: "rgba(255,255,255,0.16)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {titleCase(person.gender)}
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
                <button onClick={() => setEditing(true)}>✎ Edit</button>
                <button className="danger" onClick={archive}>Archive</button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-grid animate-in d2">
          <div className="card">
            {editing ? (
              <>
                <h3 style={{ marginTop: 0 }}>Edit details</h3>
                <PersonForm
                  initial={person}
                  submitLabel="Save changes"
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
                <h3 style={{ marginTop: 0 }}>Details</h3>
                {person._private_redacted && (
                  <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
                    🔒 Some fields are hidden for living people at your access level.
                  </p>
                )}
                <dl className="detail-dl">
                  <dt>Gender</dt><dd>{person.gender ? titleCase(person.gender) : "—"}</dd>
                  <dt>Born</dt><dd>{person.birth_date || "—"}</dd>
                  <dt>Died</dt><dd>{person.death_date || "—"}</dd>
                  <dt>Status</dt><dd>{person.is_living ? "Living" : "Deceased"}</dd>
                </dl>
                {person.notes && (
                  <>
                    <h4 style={{ marginBottom: "0.4rem" }}>Notes</h4>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{person.notes}</p>
                  </>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Family</h3>
            {relatives ? (
              <RelativeLinks treeId={treeId} relatives={relatives} />
            ) : (
              <p className="muted">Loading…</p>
            )}
          </div>
        </div>

        <div className="card animate-in d3" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>📷 Photos & memories</h3>
          <MediaGallery
            treeId={treeId}
            personId={personId}
            canEdit={canEdit}
            redacted={person._private_redacted}
          />
        </div>

        {canEdit && (
          <div className="card animate-in d4" style={{ marginTop: "1.25rem" }}>
            <h3 style={{ marginTop: 0 }}>🕓 Change history</h3>
            {changelog ? <ChangeLog entries={changelog} /> : <p className="muted">Loading…</p>}
          </div>
        )}
      </div>
    </>
  );
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RelativeLinks({ treeId, relatives }: { treeId: number; relatives: Relatives }) {
  const groups: [string, Person[]][] = [
    ["Parents", relatives.parents],
    ["Spouses", relatives.spouses],
    ["Children", relatives.children],
    ["Full siblings", relatives.siblings_full],
    ["Half siblings", relatives.siblings_half],
    ["Grandparents", relatives.grandparents],
  ];
  const anyRelatives = groups.some(([, list]) => list.length > 0);
  if (!anyRelatives)
    return <p className="muted" style={{ margin: 0 }}>No relationships recorded yet.</p>;
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
