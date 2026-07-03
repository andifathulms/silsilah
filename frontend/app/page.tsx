"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Tree, User } from "@/lib/types";
import TopBar from "@/components/TopBar";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [trees, setTrees] = useState<Tree[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    api.me().then(setUser).catch(() => {});
    api.listTrees().then(setTrees).catch((err) => setError(err.message));
  }, [router]);

  async function createTree(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const tree = await api.createTree(newName.trim());
      setNewName("");
      router.push(`/trees/${tree.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tree");
      setCreating(false);
    }
  }

  const greeting = getGreeting();

  return (
    <>
      <TopBar />
      <div className="container">
        <div className="animate-in">
          <div className="eyebrow">{greeting}{user ? `, ${user.username}` : ""}</div>
          <h1>Your family trees</h1>
          <p className="muted" style={{ maxWidth: "52ch" }}>
            Each tree is a private space for one family. Open one to keep growing it,
            or plant a new one below.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Create tree */}
        <form onSubmit={createTree} className="create-tree animate-in d1">
          <div className="create-tree-mark">🌱</div>
          <div style={{ flex: 1 }}>
            <label>Plant a new tree</label>
            <input
              placeholder="e.g. The Rahman Family"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button className="primary" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create tree"}
          </button>
        </form>

        {/* Trees grid */}
        {trees === null ? (
          <div className="tree-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card skeleton-card" />
            ))}
          </div>
        ) : trees.length === 0 ? (
          <div className="empty-state animate-in d2">
            <div className="empty-mark">🌳</div>
            <h3>No trees yet</h3>
            <p className="muted">
              Create your first tree above and add the people you love — you can
              connect them later.
            </p>
          </div>
        ) : (
          <div className="tree-grid">
            {trees.map((t, i) => (
              <Link
                key={t.id}
                href={`/trees/${t.id}`}
                className={`card card-hover tree-card animate-in d${Math.min(i + 1, 4)}`}
              >
                <div className="tree-card-top">
                  <span className="tree-card-glyph">🌳</span>
                  <span className={`badge ${t.my_role === "owner" ? "owner" : "forest"}`}>
                    {t.my_role}
                  </span>
                </div>
                <h3 className="tree-card-name">{t.name}</h3>
                <div className="tree-card-meta muted">
                  <span>👥 {t.member_count} member{t.member_count === 1 ? "" : "s"}</span>
                  {t.is_public_link_enabled && <span>· 🔗 shared</span>}
                </div>
                <span className="tree-card-open">Open tree →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
