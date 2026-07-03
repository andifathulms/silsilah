"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";

export default function TopBar() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore — clear locally regardless
    }
    clearToken();
    router.push("/login");
  }

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        🌳 Silsilah
      </Link>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}
