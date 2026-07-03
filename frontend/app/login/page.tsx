"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

const FEATURES = [
  { icon: "🌳", title: "Every branch, in one place", text: "Remarriages, adoptions, half-siblings — real families, not rigid templates." },
  { icon: "🤝", title: "Build it together", text: "Invite relatives to view or contribute. Roles keep everyone in sync." },
  { icon: "🔒", title: "Private by default", text: "Details of living relatives stay hidden unless you choose to share." },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ username, password })
          : await api.register({ username, email, password });
      setToken(res.token);
      const pendingInvite = window.localStorage.getItem("silsilah_pending_invite");
      if (pendingInvite) {
        window.localStorage.removeItem("silsilah_pending_invite");
        router.push(`/join/${pendingInvite}`);
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setMode("login");
    setUsername("demo");
    setPassword("demopass123");
  }

  return (
    <div className="auth-shell">
      {/* Left — emotional hero */}
      <aside className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-hero-inner">
          <div className="brand-lockup">
            <span className="brand-mark">🌳</span>
            <span>Silsilah</span>
          </div>

          <h1 className="hero-title">
            Every family has a story.
            <span className="hero-accent"> Start telling yours.</span>
          </h1>
          <p className="hero-sub">
            A living family tree for the people you love — map generations,
            preserve photos and memories, and rediscover how you're all connected.
          </p>

          <ul className="hero-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="hero-feature-icon">{f.icon}</span>
                <span>
                  <strong>{f.title}</strong>
                  <span className="muted-light">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="hero-foot">
            Trusted for families of 2 to 500+ · Private, invite-only trees
          </div>
        </div>
        <TreeArt />
      </aside>

      {/* Right — auth card */}
      <main className="auth-panel">
        <div className="auth-card animate-in">
          <div className="brand-lockup mobile-brand">
            <span className="brand-mark">🌳</span>
            <span>Silsilah</span>
          </div>

          <h2 className="auth-heading">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="muted" style={{ marginTop: "-0.3rem" }}>
            {mode === "login"
              ? "Pick up where your family left off."
              : "It takes less than a minute to begin."}
          </p>

          <div className="segmented">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            {mode === "register" && (
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            )}
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <div className="error">{error}</div>}
            <button className="primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: "0.4rem" }}>
              {busy ? "Just a moment…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <div className="demo-hint">
            <span className="muted">Just exploring?</span>
            <button type="button" className="ghost sm" onClick={useDemo}>
              Use demo account →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function TreeArt() {
  return (
    <svg className="tree-art" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <g stroke="rgba(224,184,76,0.5)" strokeWidth="1.4" strokeLinecap="round">
        <path d="M100 190 V120" />
        <path d="M100 130 C100 110 60 110 60 88" />
        <path d="M100 130 C100 110 140 110 140 88" />
        <path d="M60 96 C60 80 40 80 40 62" />
        <path d="M60 96 C60 80 80 80 80 62" />
        <path d="M140 96 C140 80 120 80 120 62" />
        <path d="M140 96 C140 80 160 80 160 62" />
      </g>
      <g fill="rgba(224,184,76,0.9)">
        <circle cx="100" cy="120" r="6" />
        <circle cx="60" cy="88" r="5" />
        <circle cx="140" cy="88" r="5" />
        <circle cx="40" cy="60" r="4" />
        <circle cx="80" cy="60" r="4" />
        <circle cx="120" cy="60" r="4" />
        <circle cx="160" cy="60" r="4" />
      </g>
    </svg>
  );
}
