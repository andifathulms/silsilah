"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Person, Relationship, Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";
import TreeView from "@/components/tree-view/TreeView";
import PeopleSearch from "@/components/tree-view/PeopleSearch";
import OnThisDay from "@/components/occasions/OnThisDay";
import DataPanel from "@/components/data/DataPanel";
import PersonDetailPanel from "@/components/person-detail/PersonDetailPanel";
import Modal from "@/components/Modal";
import PersonForm from "@/components/person-form/PersonForm";
import RelationshipForm from "@/components/relationship-form/RelationshipForm";
import AddRelativeForm, { RelativeKind } from "@/components/relationship-form/AddRelativeForm";
import MembersPanel from "@/components/members/MembersPanel";
import ShareLinksPanel from "@/components/share/ShareLinksPanel";

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
  const [showShare, setShowShare] = useState(false);
  const [addRelative, setAddRelative] = useState<RelativeKind | null>(null);
  const [showData, setShowData] = useState(false);

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

  const roleBadge =
    tree?.my_role === "owner" ? "owner" : "forest";

  return (
    <>
      <TopBar />
      <div className="container tree-container">
        {error && <div className="error">{error}</div>}

        <nav className="crumbs animate-in">
          <Link href="/">My trees</Link>
          <span className="muted">/</span>
          <span className="muted">{tree?.name ?? "…"}</span>
        </nav>

        <header className="tree-header animate-in d1">
          <div>
            <h1 style={{ marginBottom: "0.35rem" }}>{tree?.name ?? "Loading…"}</h1>
            <div className="row wrap" style={{ gap: "0.5rem" }}>
              <span className="badge forest">👥 {people.length} people</span>
              {tree && <span className={`badge ${roleBadge}`}>{tree.my_role}</span>}
            </div>
          </div>
          <div className="tree-toolbar">
            {people.length > 0 && (
              <Link href={`/trees/${treeId}/print`}>
                <button className="ghost">🖨 <span className="hide-sm">Print</span></button>
              </Link>
            )}
            {canEdit && (
              <>
                <button className="primary" onClick={() => setShowAddPerson(true)}>
                  <span>＋</span> Add person
                </button>
                <button onClick={() => setShowAddRel(true)} disabled={people.length < 2}>
                  🔗 <span className="hide-sm">Connect</span>
                </button>
                <button className="ghost" onClick={() => setShowData(true)}>
                  📁 <span className="hide-sm">Data</span>
                </button>
              </>
            )}
            {isOwner && (
              <div className="row" style={{ gap: "0.5rem" }}>
                <button className="ghost" onClick={() => setShowMembers(true)}>
                  👥 <span className="hide-sm">Members</span>
                </button>
                <button className="ghost" onClick={() => setShowShare(true)}>
                  🔗 <span className="hide-sm">Share</span>
                </button>
                <button className="icon-btn danger" onClick={handleDeleteTree} title="Delete tree">
                  🗑
                </button>
              </div>
            )}
          </div>
        </header>

        {tree && people.length > 0 && <OnThisDay treeId={treeId} />}

        <div className="tree-layout animate-in d2">
          <div className="tree-stage">
            {people.length > 2 && (
              <div className="tree-search-wrap">
                <PeopleSearch
                  people={people}
                  onPick={(id) => {
                    setMainId(id);
                    setSelectedId(id);
                  }}
                />
              </div>
            )}
            {tree && people.length === 0 && canEdit ? (
              <div className="onboarding">
                <div className="empty-mark" style={{ fontSize: "3rem" }}>🌱</div>
                <h2 style={{ margin: "0.25rem 0" }}>Let's plant your tree</h2>
                <p className="muted" style={{ maxWidth: "34ch", margin: "0 auto 1rem" }}>
                  The easiest way to start is with yourself. Then add your parents,
                  and grow outward from there.
                </p>
                <button className="primary" onClick={() => setShowAddPerson(true)}>
                  ✨ Start with yourself
                </button>
                <ol className="onboarding-steps">
                  <li><strong>1.</strong> Add yourself</li>
                  <li><strong>2.</strong> Select yourself, then <em>+ Parent</em> / <em>+ Spouse</em></li>
                  <li><strong>3.</strong> Invite relatives to help fill it in</li>
                </ol>
              </div>
            ) : (
              <TreeView
                people={people}
                relationships={relationships}
                mainId={mainId}
                onSelect={setSelectedId}
              />
            )}
            {people.length > 0 && (
              <div className="tree-hint">Click a person to focus · drag to pan · scroll to zoom</div>
            )}
          </div>
          <aside className="detail-col">
            {selected ? (
              <PersonDetailPanel
                treeId={treeId}
                person={selected}
                canEdit={canEdit}
                onAddRelative={(kind) => setAddRelative(kind)}
                onRecenter={(id) => {
                  setMainId(id);
                  setSelectedId(id);
                }}
              />
            ) : (
              <div className="card detail-empty">
                <div className="empty-mark" style={{ fontSize: "2.2rem" }}>👆</div>
                <p className="muted" style={{ margin: 0 }}>
                  {people.length
                    ? "Select a person on the tree to see their details and relatives."
                    : "Add your first person to begin building this tree."}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showAddPerson && (
        <Modal
          title="Add a person"
          subtitle="Only a name is required — connect them to others anytime."
          onClose={() => setShowAddPerson(false)}
        >
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
        <Modal
          title="Connect two people"
          subtitle="Parent → child, or spouse. Direction matters for parent-child."
          onClose={() => setShowAddRel(false)}
        >
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
        <Modal
          title="Members & invites"
          subtitle="Invite relatives as editors or viewers."
          onClose={() => setShowMembers(false)}
        >
          <MembersPanel treeId={treeId} />
        </Modal>
      )}

      {showShare && tree && (
        <Modal
          title="Share this tree"
          subtitle="Create read-only links — for the whole tree or one branch."
          onClose={() => setShowShare(false)}
        >
          <ShareLinksPanel treeId={treeId} people={people} />
        </Modal>
      )}

      {showData && tree && (
        <Modal
          title="Import & export"
          subtitle="Move this tree in or out with GEDCOM — the genealogy standard."
          onClose={() => setShowData(false)}
        >
          <DataPanel
            treeId={treeId}
            treeName={tree.name}
            onImported={() => {
              reload();
            }}
          />
        </Modal>
      )}

      {addRelative && selected && (
        <Modal
          title={`Add ${addRelative}`}
          subtitle="Creates the person and connects them in one step."
          onClose={() => setAddRelative(null)}
        >
          <AddRelativeForm
            treeId={treeId}
            anchor={selected}
            kind={addRelative}
            onCancel={() => setAddRelative(null)}
            onDone={async (createdId) => {
              setAddRelative(null);
              await reload();
              setSelectedId(createdId);
            }}
          />
        </Modal>
      )}
    </>
  );
}
