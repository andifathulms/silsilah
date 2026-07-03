"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { User } from "@/lib/types";
import ThemeToggle from "@/components/ThemeToggle";

export default function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      /* clear locally regardless */
    }
    clearToken();
    router.push("/login");
  }

  const initial = (user?.username || "?").charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-inner">
      <Link href="/" className="brand">
        <span className="brand-mark">🌳</span> Silsilah
      </Link>

      <div className="row" style={{ gap: "0.5rem" }}>
      <ThemeToggle />
      <div style={{ position: "relative" }}>
        <button
          className="ghost"
          onClick={() => setMenu((m) => !m)}
          style={{ paddingLeft: "0.35rem" }}
        >
          <span className="avatar" style={{ width: 30, height: 30, fontSize: "0.8rem" }}>
            {initial}
          </span>
          <span className="hide-sm">{user?.username ?? "Account"}</span>
          <span className="muted" style={{ fontSize: "0.7rem" }}>▾</span>
        </button>
        {menu && (
          <>
            <div className="menu-backdrop" onClick={() => setMenu(false)} />
            <div className="menu-pop animate-in">
              <div className="menu-head">
                <div className="avatar" style={{ width: 36, height: 36 }}>{initial}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{user?.username}</div>
                  <div className="muted" style={{ fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user?.email}
                  </div>
                </div>
              </div>
              <Link href="/" className="menu-item" onClick={() => setMenu(false)}>
                🏡 My trees
              </Link>
              <button className="menu-item danger-text" onClick={handleLogout}>
                ↩ Log out
              </button>
            </div>
          </>
        )}
      </div>
      </div>
      </div>
    </header>
  );
}
