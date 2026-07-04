"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Person, Relatives } from "@/lib/types";
import PersonForm from "@/components/person-form/PersonForm";
import { useI18n } from "@/lib/i18n";

export type RelativeKind = "parent" | "child" | "spouse" | "sibling";

interface Props {
  treeId: number;
  anchor: Person;
  kind: RelativeKind;
  people: Person[];
  onDone: (createdOrLinkedId: number) => void;
  onCancel: () => void;
}

/**
 * Add a relative in one flow — either creating a NEW person or LINKING an
 * existing one — always with correct edges:
 *  - child   → linked to the anchor and (optionally) the anchor's spouse(s)
 *  - sibling → linked to the anchor's parents (shared couple)
 *  - parent/spouse → single edge
 */
export default function AddRelativeForm({ treeId, anchor, kind, people, onDone, onCancel }: Props) {
  const { t } = useI18n();
  const kindLabel = t(`kind.${kind}`);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [relatives, setRelatives] = useState<Relatives | null>(null);
  const [coParentIds, setCoParentIds] = useState<Set<number>>(new Set());
  const [existingId, setExistingId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRelatives(treeId, anchor.id)
      .then((r) => {
        setRelatives(r);
        setCoParentIds(new Set(r.spouses.map((s) => s.id)));
      })
      .catch(() => setRelatives({
        parents: [], children: [], spouses: [],
        siblings_full: [], siblings_half: [], grandparents: [],
      }));
  }, [treeId, anchor.id]);

  // People already in this relation — hide from the "existing" picker.
  const excluded = useMemo(() => {
    const set = new Set<number>([anchor.id]);
    if (!relatives) return set;
    const add = (list: Person[]) => list.forEach((p) => set.add(p.id));
    if (kind === "parent") add(relatives.parents);
    else if (kind === "spouse") add(relatives.spouses);
    else if (kind === "child") add(relatives.children);
    else if (kind === "sibling") {
      add(relatives.siblings_full);
      add(relatives.siblings_half);
      add(relatives.parents);
    }
    return set;
  }, [relatives, kind, anchor.id]);

  const candidates = useMemo(
    () => people.filter((p) => !excluded.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [people, excluded]
  );

  function toggleCoParent(id: number) {
    setCoParentIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function link(type: "parent_child" | "spouse", a: number, b: number) {
    await api.createRelationship(treeId, { type, person_a: a, person_b: b });
  }

  /** Apply the correct edges for `kind` to a target person id. */
  async function applyLinks(targetId: number) {
    if (kind === "spouse") {
      await link("spouse", anchor.id, targetId);
    } else if (kind === "parent") {
      await link("parent_child", targetId, anchor.id);
    } else if (kind === "child") {
      await link("parent_child", anchor.id, targetId);
      for (const spouseId of coParentIds) await link("parent_child", spouseId, targetId);
    } else if (kind === "sibling") {
      for (const parent of relatives?.parents ?? []) {
        await link("parent_child", parent.id, targetId);
      }
    }
  }

  async function handleNew(values: Parameters<typeof api.createPerson>[1]) {
    const created = await api.createPerson(treeId, {
      ...values,
      birth_date: (values.birth_date as string) || null,
      death_date: (values.death_date as string) || null,
    });
    await applyLinks(created.id);
    onDone(created.id);
  }

  async function handleExisting(e: React.FormEvent) {
    e.preventDefault();
    if (existingId === "") {
      setError(t("addrel.pickToLink"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyLinks(Number(existingId));
      onDone(Number(existingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addrel.linkError"));
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
        {t("addrel.addingA")} <strong>{kindLabel}</strong> {t("addrel.of")} <strong>{anchor.name}</strong>.
      </p>

      <div className="segmented" style={{ margin: "0 0 1rem" }}>
        <button type="button" className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>
          {t("addrel.newPerson")}
        </button>
        <button type="button" className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>
          {t("addrel.existingPerson")}
        </button>
      </div>

      {kind === "child" && (relatives?.spouses.length ?? 0) > 0 && (
        <div className="coparent-box">
          <div className="rel-label" style={{ marginBottom: "0.4rem" }}>{t("addrel.alsoChildOf")}</div>
          {relatives!.spouses.map((s) => (
            <label key={s.id} className="check" style={{ marginBottom: "0.3rem" }}>
              <input type="checkbox" checked={coParentIds.has(s.id)} onChange={() => toggleCoParent(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      )}

      {kind === "sibling" && relatives && (
        <div className="coparent-box">
          {relatives.parents.length > 0 ? (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {relatives.parents.length > 1 ? t("addrel.willShare") : t("addrel.willShareOne")}{" "}
              <strong>{relatives.parents.map((p) => p.name).join(" & ")}</strong>.
            </span>
          ) : (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {t("addrel.noParents", { name: anchor.name })}
            </span>
          )}
        </div>
      )}

      {mode === "new" ? (
        <PersonForm submitLabel={t("addrel.addKind", { kind: kindLabel })} onSubmit={handleNew} onCancel={onCancel} />
      ) : (
        <form onSubmit={handleExisting}>
          <div className="field">
            <label>{t("addrel.chooseExisting")}</label>
            <select value={existingId} onChange={(e) => setExistingId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("addrel.selectPerson")}</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="muted" style={{ fontSize: "0.82rem" }}>{t("addrel.noEligible")}</p>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button className="primary" type="submit" disabled={busy || existingId === ""}>
              {busy ? t("addrel.linking") : t("addrel.linkAs", { kind: kindLabel })}
            </button>
            <button type="button" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
