"use client";

import { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import type { MediaItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface Props {
  treeId: number;
  personId: number;
  canEdit: boolean;
  /** When the person is living and viewer lacks access, the backend returns
   * nothing — show a privacy hint instead of an empty gallery. */
  redacted?: boolean;
}

/**
 * Photo gallery for a Person (PRD #22). Each item is a photo with an optional
 * caption + life-event date. Upload/delete gated to Editor+.
 */
export default function MediaGallery({
  treeId,
  personId,
  canEdit,
  redacted,
}: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setItems(await api.listMedia(treeId, personId));
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, personId]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("media.chooseFirst"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.uploadMedia(treeId, personId, file, caption, eventDate);
      setCaption("");
      setEventDate("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm(t("media.deleteConfirm"))) return;
    await api.deleteMedia(treeId, personId, id);
    await load();
  }

  return (
    <div>
      {redacted && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>{t("media.privacyHidden")}</p>
      )}

      {items.length === 0 ? (
        <p className="muted" style={{ margin: redacted ? "0" : "0 0 0.5rem" }}>
          {t("media.none")}{canEdit ? t("media.addStart") : ""}
        </p>
      ) : (
        <div className="media-grid">
          {items.map((m) => (
            <figure key={m.id} className="media-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(m.image) ?? ""} alt={m.caption || "photo"} />
              {canEdit && (
                <button className="media-del" onClick={() => remove(m.id)} title="Delete">
                  ✕
                </button>
              )}
              {(m.caption || m.event_date) && (
                <figcaption className="media-cap">
                  {m.caption}
                  {m.event_date ? ` · ${m.event_date}` : ""}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={upload} className="upload-box">
          <label>{t("media.addPhoto")}</label>
          <input ref={fileRef} type="file" accept="image/*" />
          <div className="row wrap" style={{ marginTop: "0.5rem" }}>
            <input
              placeholder={t("media.captionPh")}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{ width: "auto" }}
            />
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "…" : t("media.upload")}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      )}
    </div>
  );
}
