"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Invitation, Membership } from "@/lib/types";

function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/join/${token}`;
  return `${window.location.origin}/join/${token}`;
}

export default function MembersPanel({ treeId }: { treeId: number }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [linkRole, setLinkRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    try {
      const [m, i] = await Promise.all([
        api.listMembers(treeId),
        api.listInvitations(treeId).catch(() => []),
      ]);
      setMembers(m);
      setInvites(i.filter((x) => !x.accepted_by));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.invite(treeId, email, role);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function makeLink() {
    setError(null);
    try {
      await api.createInvitation(treeId, linkRole);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link");
    }
  }

  async function copyLink(inv: Invitation) {
    const url = inviteUrl(inv.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(inv.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function revokeLink(id: number) {
    await api.deleteInvitation(treeId, id);
    await load();
  }

  return (
    <div>
      <div className="member-list">
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <div className="avatar" style={{ width: 36, height: 36, fontSize: "0.85rem" }}>
              {(m.username || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{m.username}</div>
              <div className="muted" style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                {m.email}
              </div>
            </div>
            <span className={`badge ${m.role === "owner" ? "owner" : "forest"}`}>{m.role}</span>
          </div>
        ))}
      </div>

      <div className="divider" />

      {/* Invite by shareable link — no account needed up front */}
      <label>Invite with a link</label>
      <div className="row" style={{ marginBottom: invites.length ? "0.75rem" : 0 }}>
        <select
          value={linkRole}
          onChange={(e) => setLinkRole(e.target.value as "editor" | "viewer")}
          style={{ width: "auto" }}
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button className="primary" type="button" onClick={makeLink}>
          🔗 Generate invite link
        </button>
      </div>

      {invites.map((inv) => (
        <div key={inv.id} className="share-link-row">
          <div className="row spread wrap" style={{ gap: "0.5rem" }}>
            <span className={`badge ${inv.role === "editor" ? "forest" : ""}`}>{inv.role} invite</span>
            <span className="row" style={{ gap: "0.4rem" }}>
              <button className="sm" onClick={() => copyLink(inv)}>
                {copied === inv.id ? "✓ Copied" : "Copy link"}
              </button>
              <button className="danger sm" onClick={() => revokeLink(inv.id)}>Revoke</button>
            </span>
          </div>
          <code className="share-link-url">{inviteUrl(inv.token)}</code>
        </div>
      ))}

      <div className="divider" />

      <form onSubmit={invite}>
        <label>Or invite an existing member by email</label>
        <div className="row">
          <input
            type="email"
            placeholder="relative@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            style={{ width: "auto" }}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button className="primary" type="submit" disabled={busy}>
            Invite
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
