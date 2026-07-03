"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Membership } from "@/lib/types";

export default function MembersPanel({ treeId }: { treeId: number }) {
  const [members, setMembers] = useState<Membership[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setMembers(await api.listMembers(treeId));
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

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        {members.map((m) => (
          <div
            key={m.id}
            className="row"
            style={{ justifyContent: "space-between", padding: "0.3rem 0" }}
          >
            <span>
              {m.username}{" "}
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {m.email}
              </span>
            </span>
            <span className={`badge ${m.role === "owner" ? "owner" : ""}`}>{m.role}</span>
          </div>
        ))}
      </div>

      <form onSubmit={invite}>
        <label>Invite by email (they must have an account)</label>
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
