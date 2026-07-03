"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

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
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400, marginTop: "8vh" }}>
      <h1 style={{ textAlign: "center" }}>🌳 Silsilah</h1>
      <p className="muted" style={{ textAlign: "center", marginTop: "-0.5rem" }}>
        Build and share your family tree
      </p>
      <div className="card">
        <div className="row" style={{ marginBottom: "1rem" }}>
          <button
            className={mode === "login" ? "primary" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Log in
          </button>
          <button
            className={mode === "register" ? "primary" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Sign up
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          {mode === "register" && (
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
      <p className="muted" style={{ textAlign: "center", fontSize: "0.8rem" }}>
        Demo login: <strong>demo</strong> / <strong>demopass123</strong>
      </p>
    </div>
  );
}
