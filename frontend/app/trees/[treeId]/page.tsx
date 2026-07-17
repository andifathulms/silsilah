"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Person, Relationship, Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";
import TreeView from "@/components/tree-view/TreeView";
import PeopleSearch from "@/components/tree-view/PeopleSearch";
import OnThisDay from "@/components/occasions/OnThisDay";
import DataPanel from "@/components/data/DataPanel";
import PlacesPanel from "@/components/places/PlacesPanel";
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
  const { t } = useI18n();
  const treeId = Number(params.treeId);

  // Size the tree canvas to the actual remaining viewport (not a fixed vh),
  // so the bottom controls/minimap always sit in view regardless of how much
  // header/occasions content sits above it.
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      if (!stageRef.current) return;
      const top = stageRef.current.getBoundingClientRect().top;
      setStageH(Math.max(360, Math.round(window.innerHeight - top - 20)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

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
  const [showPlaces, setShowPlaces] = useState(false);
  const [archived, setArchived] = useState<Person[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const canEdit = tree?.my_role === "owner" || tree?.my_role === "editor";
  const isOwner = tree?.my_role === "owner";

  const reload = useCallback(async () => {
    try {
      const [t, ppl, rels, all] = await Promise.all([
        api.getTree(treeId),
        api.listPeople(treeId),
        api.listRelationships(treeId),
        api.listPeople(treeId, true),
      ]);
      setTree(t);
      setPeople(ppl);
      setRelationships(rels);
      setArchived(all.filter((p) => p.is_archived));
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

  // A parent's spouse who isn't ALSO a parent of the selected person is a
  // likely missing co-parent (the exact "marriage ≠ parenthood" gap).
  const coParentSuggestions: Person[] = (() => {
    if (!selected) return [];
    const parentIds = relationships
      .filter((r) => r.type === "parent_child" && r.person_b === selected.id)
      .map((r) => r.person_a);
    const parentSet = new Set(parentIds);
    const found = new Set<number>();
    for (const pid of parentIds) {
      for (const r of relationships) {
        if (r.type !== "spouse") continue;
        const other = r.person_a === pid ? r.person_b : r.person_b === pid ? r.person_a : null;
        if (other != null && other !== selected.id && !parentSet.has(other)) found.add(other);
      }
    }
    return [...found].map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  })();

  async function linkParent(parentId: number) {
    if (!selected) return;
    await api.createRelationship(treeId, {
      type: "parent_child",
      person_a: parentId,
      person_b: selected.id,
    });
    await reload();
  }

  async function toggleLiving() {
    if (!selected) return;
    await api.updatePerson(treeId, selected.id, { is_living: !selected.is_living });
    await reload();
  }

  async function handleDeleteTree() {
    if (!confirm(t("tree.deleteConfirm", { name: tree?.name ?? "" }))) return;
    await api.deleteTree(treeId);
    router.push("/");
  }

  async function removePerson() {
    if (!selected) return;
    if (!confirm(t("panel.removeConfirm", { name: selected.name }))) return;
    await api.archivePerson(treeId, selected.id);
    setSelectedId(null);
    await reload();
  }

  async function disconnectRel(relId: number, otherName: string) {
    if (!selected) return;
    if (!confirm(t("panel.disconnectConfirm", { a: selected.name, b: otherName }))) return;
    await api.deleteRelationship(treeId, relId);
    await reload();
  }

  async function restorePerson(id: number) {
    await api.updatePerson(treeId, id, { is_archived: false });
    await reload();
  }

  async function deleteForever(id: number, name: string) {
    if (!confirm(t("tree.deleteForeverConfirm", { name }))) return;
    await api.deletePerson(treeId, id);
    await reload();
  }

  const roleBadge =
    tree?.my_role === "owner" ? "owner" : "forest";

  return (
    <>
      <TopBar />
      <div className="container tree-container" ref={containerRef}>
        {error && <div className="error">{error}</div>}

        <nav className="crumbs animate-in">
          <Link href="/">{t("tree.crumbMyTrees")}</Link>
          <span className="muted">/</span>
          <span className="muted">{tree?.name ?? "…"}</span>
        </nav>

        <header className="tree-header animate-in d1">
          <div>
            <h1 style={{ marginBottom: "0.35rem" }}>{tree?.name ?? t("home.loading")}</h1>
            <div className="row wrap" style={{ gap: "0.5rem" }}>
              <span className="badge forest">👥 {t("tree.people", { count: people.length })}</span>
              {tree && <span className={`badge ${roleBadge}`}>{tree.my_role}</span>}
              {canEdit && archived.length > 0 && (
                <button
                  className="badge archived-chip"
                  onClick={() => setShowArchived(true)}
                  title={t("tree.archivedTitle")}
                >
                  🗄 {t("tree.archivedChip", { n: archived.length })}
                </button>
              )}
            </div>
          </div>
          <div className="tree-toolbar">
            {people.length > 0 && (
              <>
                <button className="ghost" onClick={() => setShowPlaces(true)}>
                  🗺 <span className="hide-sm">{t("tree.places")}</span>
                </button>
                <Link href={`/trees/${treeId}/print`}>
                  <button className="ghost">🖨 <span className="hide-sm">{t("tree.print")}</span></button>
                </Link>
              </>
            )}
            {canEdit && (
              <>
                <button className="primary" onClick={() => setShowAddPerson(true)}>
                  <span>＋</span> {t("tree.addPerson")}
                </button>
                <button onClick={() => setShowAddRel(true)} disabled={people.length < 2}>
                  🔗 <span className="hide-sm">{t("tree.connect")}</span>
                </button>
                <button className="ghost" onClick={() => setShowData(true)}>
                  📁 <span className="hide-sm">{t("tree.data")}</span>
                </button>
              </>
            )}
            {isOwner && (
              <div className="row" style={{ gap: "0.5rem" }}>
                <button className="ghost" onClick={() => setShowMembers(true)}>
                  👥 <span className="hide-sm">{t("tree.members")}</span>
                </button>
                <button className="ghost" onClick={() => setShowShare(true)}>
                  🔗 <span className="hide-sm">{t("tree.share")}</span>
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
          <div
            className="tree-stage"
            ref={stageRef}
            style={stageH ? { height: stageH } : undefined}
          >
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
                <h2 style={{ margin: "0.25rem 0" }}>{t("tree.onboardTitle")}</h2>
                <p className="muted" style={{ maxWidth: "34ch", margin: "0 auto 1rem" }}>
                  {t("tree.onboardText")}
                </p>
                <button className="primary" onClick={() => setShowAddPerson(true)}>
                  {t("tree.startSelf")}
                </button>
                <ol className="onboarding-steps">
                  <li><strong>1.</strong> {t("tree.step1")}</li>
                  <li><strong>2.</strong> {t("tree.step2")}</li>
                  <li><strong>3.</strong> {t("tree.step3")}</li>
                </ol>
              </div>
            ) : (
              <TreeView
                people={people}
                relationships={relationships}
                mainId={mainId}
                onSelect={setSelectedId}
                onOpen={(id) => router.push(`/trees/${treeId}/person/${id}`)}
              />
            )}
            {people.length > 0 && (
              <div className="tree-hint">{t("tree.hint")}</div>
            )}
          </div>
          <aside
            className="detail-col"
            style={stageH ? { maxHeight: stageH, overflowY: "auto" } : undefined}
          >
            {selected ? (
              <PersonDetailPanel
                treeId={treeId}
                person={selected}
                canEdit={canEdit}
                relationships={relationships}
                coParentSuggestions={coParentSuggestions}
                onLinkParent={linkParent}
                onToggleLiving={toggleLiving}
                onRemove={removePerson}
                onDisconnect={disconnectRel}
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
                  {people.length ? t("tree.selectEmpty") : t("tree.addFirstEmpty")}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showAddPerson && (
        <Modal
          title={t("tree.addPerson")}
          subtitle={t("tree.addPersonSub")}
          onClose={() => setShowAddPerson(false)}
        >
          <PersonForm
            submitLabel={t("tree.addPerson")}
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
          title={t("tree.connect")}
          subtitle={t("tree.connectSub")}
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

      {showArchived && (
        <Modal
          title={t("tree.archivedTitle")}
          subtitle={t("tree.archivedSub")}
          onClose={() => setShowArchived(false)}
        >
          {archived.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{t("tree.noArchived")}</p>
          ) : (
            <div className="member-list">
              {archived.map((p) => (
                <div key={p.id} className="member-row">
                  <div className="avatar" style={{ width: 34, height: 34, fontSize: "0.8rem" }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                  {isOwner && (
                    <button
                      className="sm danger"
                      onClick={() => deleteForever(p.id, p.name)}
                      title={t("tree.deleteForever")}
                    >
                      🗑
                    </button>
                  )}
                  <button className="sm primary" onClick={() => restorePerson(p.id)}>
                    ↩ {t("tree.restore")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showMembers && tree && (
        <Modal
          title={t("tree.members")}
          subtitle={t("tree.membersSub")}
          onClose={() => setShowMembers(false)}
        >
          <MembersPanel treeId={treeId} />
        </Modal>
      )}

      {showShare && tree && (
        <Modal
          title={t("tree.share")}
          subtitle={t("tree.shareSub")}
          onClose={() => setShowShare(false)}
        >
          <ShareLinksPanel treeId={treeId} people={people} />
        </Modal>
      )}

      {showPlaces && tree && (
        <Modal
          title={t("tree.placesTitle")}
          subtitle={t("tree.placesSub")}
          onClose={() => setShowPlaces(false)}
        >
          <PlacesPanel treeId={treeId} />
        </Modal>
      )}

      {showData && tree && (
        <Modal
          title={t("tree.dataTitle")}
          subtitle={t("tree.dataSub")}
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
          title={t("addrel.addKind", { kind: t(`kind.${addRelative}`) })}
          subtitle={t("tree.addPersonSub")}
          onClose={() => setAddRelative(null)}
        >
          <AddRelativeForm
            treeId={treeId}
            anchor={selected}
            kind={addRelative}
            people={people}
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
