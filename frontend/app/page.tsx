"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Tree, User } from "@/lib/types";
import TopBar from "@/components/TopBar";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
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

  const h = new Date().getHours();
  const greeting =
    h < 12 ? t("home.greetMorning") : h < 18 ? t("home.greetAfternoon") : t("home.greetEvening");

  return (
    <>
      <TopBar />
      <div className="container">
        <div className="animate-in">
          <div className="eyebrow">{greeting}{user ? `, ${user.username}` : ""}</div>
          <h1>{t("home.title")}</h1>
          <p className="muted" style={{ maxWidth: "52ch" }}>{t("home.subtitle")}</p>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Create tree */}
        <form onSubmit={createTree} className="create-tree animate-in d1">
          <div className="create-tree-mark">🌱</div>
          <div style={{ flex: 1 }}>
            <label>{t("home.plantNew")}</label>
            <input
              placeholder={t("home.placeholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button className="primary" type="submit" disabled={creating}>
            {creating ? t("home.creating") : t("home.createTree")}
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
            <h3>{t("home.emptyTitle")}</h3>
            <p className="muted">{t("home.emptyText")}</p>
          </div>
        ) : (
          <div className="tree-grid">
            {trees.map((tr, i) => (
              <Link
                key={tr.id}
                href={`/trees/${tr.id}`}
                className={`card card-hover tree-card animate-in d${Math.min(i + 1, 4)}`}
              >
                <div className="tree-card-top">
                  <span className="tree-card-glyph">🌳</span>
                  <span className={`badge ${tr.my_role === "owner" ? "owner" : "forest"}`}>
                    {tr.my_role}
                  </span>
                </div>
                <h3 className="tree-card-name">{tr.name}</h3>
                <div className="tree-card-meta muted">
                  <span>👥 {tr.member_count} {tr.member_count === 1 ? t("home.member") : t("home.members")}</span>
                  {tr.is_public_link_enabled && <span>· 🔗 {t("home.shared")}</span>}
                </div>
                <span className="tree-card-open">{t("home.openTree")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
