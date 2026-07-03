"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Person, Relationship, Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";
import TreeView from "@/components/tree-view/TreeView";
import PersonDetailPanel from "@/components/person-detail/PersonDetailPanel";
import Modal from "@/components/Modal";
import PersonForm from "@/components/person-form/PersonForm";
import RelationshipForm from "@/components/relationship-form/RelationshipForm";
import MembersPanel from "@/components/members/MembersPanel";

export default function TreePage() {
  const params = useParams();
  const router = useRouter();
  const treeId = Number(params.treeId);

  const [tree, setTree] = useState<Tree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mainId, setMainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showAddRel, setShowAddRel] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const canEdit = tree?.my_role === "owner" || tree?.my_role === "editor";
  const isOwner = tree?.my_role === "owner";

  const reload = useCallback(async () => {
    try {
      const [t, ppl, rels] = await Promise.all([
        api.getTree(treeId),
        api.listPeople(treeId),
        api.listRelationships(treeId),
      ]);
      setTree(t);
      setPeople(ppl);
      setRelationships(rels);
      if (selectedId == null && ppl.length) setSelectedId(ppl[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tree");
    }
  }, [treeId, selectedId]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  const selected = people.find((p) => p.id === selectedId) || null;

  async function handleDeleteTree() {
    if (!confirm(`Delete "${tree?.name}"? This cannot be undone.`)) return;
    await api.deleteTree(treeId);
    router.push("/");
  }

  async function togglePublic() {
    if (!tree) return;
    const updated = await api.updateTree(treeId, {
      is_public_link_enabled: !tree.is_public_link_enabled,
    });
    setTree(updated);
  }

  return (
    <>
      <TopBar />
      <div className="container" style={{ maxWidth: 1200 }}>
        {error && <div className="error">{error}</div>}

        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ marginBottom: 0 }}>{tree?.name ?? "…"}</h1>
            <span className="muted">
              {people.length} people · your role: {tree?.my_role}
            </span>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {canEdit && (
              <>
                <button className="primary" onClick={() => setShowAddPerson(true)}>
                  + Person
                </button>
                <button onClick={() => setShowAddRel(true)} disabled={people.length < 2}>
                  + Relationship
                </button>
              </>
            )}
            {isOwner && (
              <>
                <button onClick={() => setShowMembers(true)}>Members</button>
                <button onClick={togglePublic}>
                  {tree?.is_public_link_enabled ? "Public link: on" : "Public link: off"}
                </button>
                <button className="danger" onClick={handleDeleteTree}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "1rem",
            marginTop: "1rem",
            alignItems: "start",
          }}
        >
          <div style={{ height: "72vh" }}>
            <TreeView
              people={people}
              relationships={relationships}
              mainId={mainId}
              onSelect={setSelectedId}
            />
          </div>
          <div>
            {selected ? (
              <PersonDetailPanel
                treeId={treeId}
                person={selected}
                onRecenter={(id) => {
                  setMainId(id);
                  setSelectedId(id);
                }}
              />
            ) : (
              <div className="card muted">Select a person to see details.</div>
            )}
          </div>
        </div>
      </div>

      {showAddPerson && (
        <Modal title="Add person" onClose={() => setShowAddPerson(false)}>
          <PersonForm
            submitLabel="Add person"
            onCancel={() => setShowAddPerson(false)}
            onSubmit={async (values) => {
              const created = await api.createPerson(treeId, {
                ...values,
                birth_date: values.birth_date || null,
                death_date: values.death_date || null,
              });
              setShowAddPerson(false);
              await reload();
              setSelectedId(created.id);
            }}
          />
        </Modal>
      )}

      {showAddRel && (
        <Modal title="Add relationship" onClose={() => setShowAddRel(false)}>
          <RelationshipForm
            people={people}
            anchorId={selectedId ?? undefined}
            onCancel={() => setShowAddRel(false)}
            onSubmit={async (body) => {
              await api.createRelationship(treeId, body);
              setShowAddRel(false);
              await reload();
            }}
          />
        </Modal>
      )}

      {showMembers && tree && (
        <Modal title="Members & invites" onClose={() => setShowMembers(false)}>
          <MembersPanel treeId={treeId} />
        </Modal>
      )}
    </>
  );
}
