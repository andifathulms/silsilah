"use client";

import { useEffect, useState } from "react";

/** Light/dark toggle. Persists to localStorage; layout applies it pre-paint. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("silsilah_theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button className="icon-btn ghost" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
