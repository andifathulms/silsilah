"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api";
import type { Person, Relationship, Relatives } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function genderLabel(t: (k: string) => string, gender: string): string {
  const g = (gender || "").toLowerCase();
  if (g.startsWith("m")) return t("gender.male");
  if (g.startsWith("f") || g.startsWith("w")) return t("gender.female");
  if (g) return t("gender.other");
  return "";
}

interface Props {
  treeId: number;
  person: Person;
  canEdit?: boolean;
  coParentSuggestions?: Person[];
  relationships?: Relationship[];
  onLinkParent?: (parentId: number) => void;
  onToggleLiving?: () => void;
  onRemove?: () => void;
  onDisconnect?: (relId: number, otherName: string) => void;
  onRecenter?: (personId: number) => void;
  onAddRelative?: (kind: "parent" | "child" | "spouse" | "sibling") => void;
}

function RelativeRow({
  label,
  people,
  findRel,
  onDisconnect,
}: {
  label: string;
  people: Person[];
  /** For direct relations, return the edge id linking to a relative (else null). */
  findRel?: (relativeId: number) => number | null;
  onDisconnect?: (relId: number, otherName: string) => void;
}) {
  if (!people.length) return null;
  const canDisconnect = findRel && onDisconnect;
  return (
    <div className="rel-row">
      <span className="rel-label">{label}</span>
      <span className="rel-people">
        {canDisconnect
          ? people.map((p, i) => {
              const relId = findRel!(p.id);
              return (
                <span key={p.id} className="rel-chip">
                  {p.name}
                  {relId != null && (
                    <button
                      className="rel-x"
                      title="Disconnect"
                      onClick={() => onDisconnect!(relId, p.name)}
                    >
                      ✕
                    </button>
                  )}
                  {i < people.length - 1 ? " " : ""}
                </span>
              );
            })
          : people.map((p) => p.name).join(", ")}
      </span>
    </div>
  );
}

/**
 * Compact, elegant panel shown alongside the tree. Derived relationships come
 * from the backend `/relatives/` endpoint — never recomputed in the browser.
 */
export default function PersonDetailPanel({
  treeId,
  person,
  canEdit,
  coParentSuggestions = [],
  relationships,
  onLinkParent,
  onToggleLiving,
  onRemove,
  onDisconnect,
  onRecenter,
  onAddRelative,
}: Props) {
  const { t } = useI18n();
  const [relatives, setRelatives] = useState<Relatives | null>(null);

  const rels = relationships ?? [];
  const findParentRel = (rid: number) =>
    rels.find((r) => r.type === "parent_child" && r.person_a === rid && r.person_b === person.id)?.id ?? null;
  const findChildRel = (rid: number) =>
    rels.find((r) => r.type === "parent_child" && r.person_a === person.id && r.person_b === rid)?.id ?? null;
  const findSpouseRel = (rid: number) =>
    rels.find(
      (r) =>
        r.type === "spouse" &&
        ((r.person_a === person.id && r.person_b === rid) ||
          (r.person_a === rid && r.person_b === person.id))
    )?.id ?? null;
  const disconnectProps = canEdit && onDisconnect && relationships ? { onDisconnect } : {};

  useEffect(() => {
    setRelatives(null);
    api.getRelatives(treeId, person.id).then(setRelatives).catch(() => setRelatives(null));
  }, [treeId, person.id]);

  const initial = person.name.charAt(0).toUpperCase();
  const photo = mediaUrl(person.photo);
  const lifespan = [person.birth_date?.slice(0, 4), person.death_date?.slice(0, 4)];
  const hasLifespan = lifespan[0] || lifespan[1];

  return (
    <div className="card detail-card">
      <div className={`detail-banner ${person.is_living ? "living" : "deceased"}`} />
      <div className="detail-head">
        <div className="avatar detail-avatar">
          {photo ? <img src={photo} alt={person.name} /> : initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="detail-name">{person.name}</h3>
          <div className="detail-sub">
            {person.gender && <span>{genderLabel(t, person.gender)}</span>}
            {person.gender && hasLifespan && <span> · </span>}
            {hasLifespan && (
              <span>
                {lifespan[0] ?? "?"}
                {person.death_date ? `–${lifespan[1]}` : person.is_living ? "" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: "0.4rem", marginBottom: "0.85rem" }}>
        <span className={`badge ${person.is_living ? "forest" : ""}`}>
          {person.is_living ? `● ${t("person.living")}` : t("person.inMemory")}
        </span>
        {person._private_redacted && <span className="badge">{t("panel.private")}</span>}
      </div>

      {person._private_redacted && (
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
          {t("panel.privacyNote")}
        </p>
      )}

      {relatives ? (
        <div className="rel-list">
          <RelativeRow label={t("panel.parents")} people={relatives.parents} findRel={findParentRel} {...disconnectProps} />
          <RelativeRow label={t("panel.spouses")} people={relatives.spouses} findRel={findSpouseRel} {...disconnectProps} />
          <RelativeRow label={t("panel.children")} people={relatives.children} findRel={findChildRel} {...disconnectProps} />
          <RelativeRow label={t("panel.fullSiblings")} people={relatives.siblings_full} />
          <RelativeRow label={t("panel.halfSiblings")} people={relatives.siblings_half} />
          <RelativeRow label={t("panel.grandparents")} people={relatives.grandparents} />
          {isEmpty(relatives) && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>{t("panel.noRelatives")}</p>
          )}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: "0.85rem" }}>{t("panel.loadingRelatives")}</p>
      )}

      {canEdit && onLinkParent && coParentSuggestions.length > 0 && (
        <div className="suggest-box">
          <div className="suggest-title">{t("panel.suggested")}</div>
          {coParentSuggestions.map((s) => (
            <button key={s.id} className="suggest-chip" onClick={() => onLinkParent(s.id)}>
              ＋ {t("panel.addWord")} <strong>{s.name}</strong> {t("panel.asParent")}
              <span className="muted"> {t("panel.marriedNote")}</span>
            </button>
          ))}
        </div>
      )}

      {canEdit && onAddRelative && (
        <div className="quick-add">
          <span className="rel-label" style={{ alignSelf: "center" }}>{t("panel.add")}</span>
          <button className="sm" onClick={() => onAddRelative("parent")}>{t("panel.parent")}</button>
          <button className="sm" onClick={() => onAddRelative("sibling")}>{t("panel.sibling")}</button>
          <button className="sm" onClick={() => onAddRelative("spouse")}>{t("panel.spouse")}</button>
          <button className="sm" onClick={() => onAddRelative("child")}>{t("panel.child")}</button>
        </div>
      )}

      {canEdit && (onToggleLiving || onRemove) && (
        <div className="row" style={{ marginTop: "0.75rem", gap: "0.5rem" }}>
          {onToggleLiving && (
            <button className="sm" style={{ flex: 1 }} onClick={onToggleLiving}>
              {person.is_living ? t("panel.markDeceased") : t("panel.markLiving")}
            </button>
          )}
          {onRemove && (
            <button className="sm danger" onClick={onRemove} title={t("panel.remove")}>
              🗑 {t("panel.remove")}
            </button>
          )}
        </div>
      )}

      <div className="detail-actions">
        {onRecenter && (
          <button className="sm" onClick={() => onRecenter(person.id)}>
            {t("panel.centerHere")}
          </button>
        )}
        <Link href={`/trees/${treeId}/person/${person.id}`} style={{ flex: 1 }}>
          <button className="primary sm" style={{ width: "100%" }}>
            {t("panel.viewProfile")}
          </button>
        </Link>
      </div>
    </div>
  );
}

function isEmpty(r: Relatives) {
  return (
    r.parents.length +
      r.spouses.length +
      r.children.length +
      r.siblings_full.length +
      r.siblings_half.length +
      r.grandparents.length ===
    0
  );
}
