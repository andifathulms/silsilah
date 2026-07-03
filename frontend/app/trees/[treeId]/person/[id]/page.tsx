"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { ChangeLogEntry, Person, Relatives, Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";
import PersonForm from "@/components/person-form/PersonForm";

function ChangeLog({ entries }: { entries: ChangeLogEntry[] }) {
  if (!entries.length) return <p className="muted">No changes recorded yet.</p>;
  return (
    <div>
      {entries.map((e) => (
        <div key={e.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {e.changed_by_username ?? "someone"} · {new Date(e.changed_at).toLocaleString()}
          </div>
          <ul style={{ margin: "0.3rem 0", paddingLeft: "1.2rem" }}>
            {Object.entries(e.diff).map(([field, [oldV, newV]]) => (
              <li key={field}>
                <strong>{field}</strong>: {String(oldV ?? "—")} → {String(newV ?? "—")}
              </li>
            ))}
          </ul>
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

  if (error) return <div className="container error">{error}</div>;
  if (!person) return <div className="container muted">Loading…</div>;

  return (
    <>
      <TopBar />
      <div className="container">
        <Link href={`/trees/${treeId}`}>← Back to tree</Link>

        <div className="row" style={{ justifyContent: "space-between", marginTop: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>{person.name}</h1>
          {canEdit && !editing && (
            <div className="row">
              <button onClick={() => setEditing(true)}>Edit</button>
              <button className="danger" onClick={archive}>
                Archive
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div className="card">
            {editing ? (
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
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Details</h3>
                {person._private_redacted && (
                  <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                    🔒 Some fields are hidden for living people at your access level.
                  </div>
                )}
                <p>
                  <span className="muted">Gender:</span> {person.gender || "—"}
                  <br />
                  <span className="muted">Born:</span> {person.birth_date || "—"}
                  <br />
                  <span className="muted">Died:</span> {person.death_date || "—"}
                  <br />
                  <span className="muted">Status:</span>{" "}
                  {person.is_living ? "Living" : "Deceased"}
                </p>
                {person.notes && (
                  <>
                    <h4>Notes</h4>
                    <p style={{ whiteSpace: "pre-wrap" }}>{person.notes}</p>
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

        {canEdit && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Change history</h3>
            {changelog ? <ChangeLog entries={changelog} /> : <p className="muted">Loading…</p>}
          </div>
        )}
      </div>
    </>
  );
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
  if (!anyRelatives) return <p className="muted">No relationships recorded yet.</p>;
  return (
    <>
      {groups.map(([label, list]) =>
        list.length ? (
          <div key={label} style={{ marginBottom: "0.6rem" }}>
            <div className="muted" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>
              {label}
            </div>
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/trees/${treeId}/person/${p.id}`}
                style={{ marginRight: "0.6rem" }}
              >
                {p.name}
              </Link>
            ))}
          </div>
        ) : null
      )}
    </>
  );
}
