"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Tree } from "@/lib/types";
import TopBar from "@/components/TopBar";

export default function HomePage() {
  const router = useRouter();
  const [trees, setTrees] = useState<Tree[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    api
      .listTrees()
      .then(setTrees)
      .catch((err) => setError(err.message));
  }, [router]);

  async function createTree(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const tree = await api.createTree(newName.trim());
      setNewName("");
      router.push(`/trees/${tree.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tree");
    }
  }

  return (
    <>
      <TopBar />
      <div className="container">
        <h1>Your family trees</h1>
        {error && <div className="error">{error}</div>}

        <form onSubmit={createTree} className="card" style={{ marginBottom: "1.5rem" }}>
          <label>Create a new tree</label>
          <div className="row">
            <input
              placeholder="e.g. The Rahman Family"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="primary" type="submit">
              Create
            </button>
          </div>
        </form>

        {trees === null ? (
          <p className="muted">Loading…</p>
        ) : trees.length === 0 ? (
          <p className="muted">
            No trees yet. Create one above to get started.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {trees.map((t) => (
              <Link key={t.id} href={`/trees/${t.id}`} className="card" style={{ display: "block" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{t.name}</strong>
                  <span className={`badge ${t.my_role === "owner" ? "owner" : ""}`}>
                    {t.my_role}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {t.member_count} member{t.member_count === 1 ? "" : "s"}
                  {t.is_public_link_enabled ? " · public link on" : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
