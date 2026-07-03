"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Person, ShareLink } from "@/lib/types";

interface Props {
  treeId: number;
  people: Person[];
}

function publicUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

/**
 * Owner-only manager for read-only public links. A link is either whole-tree
 * or scoped to a single person's branch (open question #21). Anonymous
 * visitors see Viewer-level privacy.
 */
export default function ShareLinksPanel({ treeId, people }: Props) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [scope, setScope] = useState<"whole_tree" | "branch">("whole_tree");
  const [rootPerson, setRootPerson] = useState<number | "">("");
  const [includeAncestors, setIncludeAncestors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    try {
      setLinks(await api.listShareLinks(treeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load links");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (scope === "branch" && rootPerson === "") {
      setError("Pick a person to root the branch on.");
      return;
    }
    try {
      await api.createShareLink(treeId, {
        root_person: scope === "branch" ? Number(rootPerson) : null,
        include_ancestors: scope === "branch" ? includeAncestors : false,
      });
      setRootPerson("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    }
  }

  async function copy(link: ShareLink) {
    const url = publicUrl(link.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(link.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function remove(id: number) {
    if (!confirm("Revoke this share link? Anyone using it will lose access.")) return;
    await api.deleteShareLink(treeId, id);
    await load();
  }

  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      {links.length === 0 ? (
        <p className="muted">No active share links.</p>
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          {links.map((l) => (
            <div key={l.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <span className="badge">{l.scope === "branch" ? "branch" : "whole tree"}</span>{" "}
                  {l.root_person_name && (
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {l.root_person_name}
                      {l.include_ancestors ? " + ancestors" : ""}
                    </span>
                  )}
                </span>
                <span className="row">
                  <button onClick={() => copy(l)}>
                    {copied === l.id ? "Copied!" : "Copy link"}
                  </button>
                  <button className="danger" onClick={() => remove(l.id)}>
                    Revoke
                  </button>
                </span>
              </div>
              <code style={{ fontSize: "0.72rem", color: "var(--muted)", wordBreak: "break-all" }}>
                {publicUrl(l.token)}
              </code>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={create}>
        <label>Create a read-only public link</label>
        <div className="field">
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="whole_tree">Whole tree</option>
            <option value="branch">Single branch</option>
          </select>
        </div>
        {scope === "branch" && (
          <>
            <div className="field">
              <label>Root person (branch = this person + descendants)</label>
              <select
                value={rootPerson}
                onChange={(e) => setRootPerson(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select…</option>
                {sorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={includeAncestors}
                  onChange={(e) => setIncludeAncestors(e.target.checked)}
                  style={{ width: "auto", marginRight: 6 }}
                />
                Also include ancestors
              </label>
            </div>
          </>
        )}
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit">
          Create link
        </button>
      </form>
    </div>
  );
}
