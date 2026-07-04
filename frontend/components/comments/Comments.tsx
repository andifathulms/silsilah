"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface Props {
  treeId: number;
  personId: number;
  personName: string;
  canPost: boolean;
}

/** Collaborative memories/stories on a person. */
export default function Comments({ treeId, personId, personName, canPost }: Props) {
  const { t } = useI18n();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setComments(await api.listComments(treeId, personId));
    } catch {
      setComments([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, personId]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.createComment(treeId, personId, body.trim());
      setBody("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm(t("comments.deleteConfirm"))) return;
    await api.deleteComment(treeId, personId, id);
    await load();
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="muted" style={{ margin: canPost ? "0 0 1rem" : 0 }}>
          {t("comments.none")} {canPost ? t("comments.shareMemory", { name: personName }) : ""}
        </p>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <div className="avatar" style={{ width: 34, height: 34, fontSize: "0.8rem" }}>
                {(c.author_username || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row spread" style={{ gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{c.author_username ?? "—"}</strong>
                  <span className="muted" style={{ fontSize: "0.76rem" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ margin: "0.2rem 0 0", whiteSpace: "pre-wrap" }}>{c.body}</p>
              </div>
              <button className="sm ghost" onClick={() => remove(c.id)} title="Delete">✕</button>
            </div>
          ))}
        </div>
      )}

      {canPost && (
        <form onSubmit={post} style={{ marginTop: comments.length ? "1rem" : 0 }}>
          <textarea
            rows={2}
            placeholder={t("comments.placeholder", { name: personName })}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="primary" type="submit" disabled={busy || !body.trim()} style={{ marginTop: "0.5rem" }}>
            {busy ? t("comments.posting") : t("comments.post")}
          </button>
        </form>
      )}
    </div>
  );
}
