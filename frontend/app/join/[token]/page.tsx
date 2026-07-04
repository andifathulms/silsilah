"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { InvitePreview } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const token = String(params.token);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .previewInvitation(token)
      .then(setPreview)
      .catch(() => setError(t("join.invalid")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept() {
    if (!isAuthenticated()) {
      // Remember where to return after login/signup.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("silsilah_pending_invite", token);
      }
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const res = await api.acceptInvitation(token);
      router.push(`/trees/${res.tree}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("join.error"));
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 460, marginTop: "8vh" }}>
      <div className="card animate-in" style={{ textAlign: "center" }}>
        <div className="empty-mark" style={{ fontSize: "2.6rem" }}>🌳</div>
        {error ? (
          <>
            <h2>{t("join.unavailable")}</h2>
            <p className="muted">{error}</p>
            <a href="/"><button>{t("join.goHome")}</button></a>
          </>
        ) : !preview ? (
          <p className="muted">{t("join.loading")}</p>
        ) : (
          <>
            <div className="eyebrow">{t("join.invited")}</div>
            <h2 style={{ margin: "0.3rem 0" }}>{preview.tree.name}</h2>
            <p className="muted">
              {preview.invited_by ? t("join.invitedBy", { who: preview.invited_by }) : t("join.invitedGeneric")}{" "}
              {t("join.toJoinAs")} <strong>{preview.role}</strong>.
            </p>
            {preview.already_member ? (
              <a href={`/trees/${preview.tree.id}`}>
                <button className="primary" style={{ width: "100%" }}>{t("join.openTree")}</button>
              </a>
            ) : (
              <button className="primary" onClick={accept} disabled={busy} style={{ width: "100%" }}>
                {busy ? t("join.joining") : isAuthenticated() ? t("join.acceptJoin") : t("join.signInJoin")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
