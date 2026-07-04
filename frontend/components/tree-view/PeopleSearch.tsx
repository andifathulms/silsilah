"use client";

import { useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

interface Props {
  people: Person[];
  onPick: (personId: number) => void;
}

/**
 * Search-and-jump for large trees (NFR: usable at 500+ people). Filters the
 * already-loaded people client-side and re-centers the tree on the pick.
 */
export default function PeopleSearch({ people, onPick }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, people]);

  function pick(p: Person) {
    onPick(p.id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="people-search" ref={boxRef}>
      <span className="people-search-icon">🔍</span>
      <input
        value={query}
        placeholder={t("tree.searchPlaceholder")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <div className="people-search-results">
          {results.map((p, i) => (
            <button
              key={p.id}
              className={`people-search-item ${i === active ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
            >
              <span className="avatar" style={{ width: 26, height: 26, fontSize: "0.72rem" }}>
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
              {p.birth_date && (
                <span className="muted" style={{ fontSize: "0.75rem" }}>
                  {p.birth_date.slice(0, 4)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
