"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Occasion } from "@/lib/types";

const META = {
  birthday: { icon: "🎂", verb: "Birthday" },
  anniversary: { icon: "💍", verb: "Anniversary" },
  memorial: { icon: "🕊", verb: "Remembering" },
};

function when(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function detail(o: Occasion): string {
  if (o.kind === "birthday" && o.turning) return `turning ${o.turning}`;
  if (o.kind === "anniversary" && o.years) return `${o.years} years`;
  if (o.kind === "memorial" && o.years_ago) return `${o.years_ago} years ago`;
  return "";
}

export default function OnThisDay({ treeId }: { treeId: number }) {
  const [occasions, setOccasions] = useState<Occasion[] | null>(null);

  useEffect(() => {
    api.onThisDay(treeId).then((r) => setOccasions(r.occasions)).catch(() => setOccasions([]));
  }, [treeId]);

  if (!occasions || occasions.length === 0) return null;

  return (
    <div className="occasions animate-in">
      <span className="occasions-label">✨ Coming up</span>
      <div className="occasions-strip">
        {occasions.map((o, i) => (
          <Link key={i} href={`/trees/${treeId}/person/${o.person}`} className="occasion-chip">
            <span className="occasion-icon">{META[o.kind].icon}</span>
            <span>
              <strong>{o.name}</strong>
              <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                {META[o.kind].verb} {when(o.days_until)}
                {detail(o) ? ` · ${detail(o)}` : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
