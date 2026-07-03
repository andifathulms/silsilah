"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PlaceGroup } from "@/lib/types";

/** Roots & places — where the family has lived, married, and migrated,
 *  aggregated from life-event locations. */
export default function PlacesPanel({ treeId }: { treeId: number }) {
  const [places, setPlaces] = useState<PlaceGroup[] | null>(null);

  useEffect(() => {
    api.places(treeId).then((r) => setPlaces(r.places)).catch(() => setPlaces([]));
  }, [treeId]);

  if (!places) return <p className="muted">Loading places…</p>;
  if (places.length === 0)
    return (
      <p className="muted" style={{ margin: 0 }}>
        No places yet. Add a <strong>place</strong> to people's life events (birth,
        residence, migration…) and they'll gather here.
      </p>
    );

  const max = Math.max(...places.map((p) => p.count));

  return (
    <div className="places-list">
      {places.map((p) => (
        <div key={p.place} className="place-row">
          <div className="row spread" style={{ gap: "0.5rem" }}>
            <strong>📍 {p.place}</strong>
            <span className="badge forest">{p.count}</span>
          </div>
          <div className="place-bar">
            <div className="place-bar-fill" style={{ width: `${(p.count / max) * 100}%` }} />
          </div>
          <div className="place-people">
            {p.entries.slice(0, 8).map((e, i) => (
              <Link key={i} href={`/trees/${treeId}/person/${e.person}`} className="place-chip">
                {e.name}
                <span className="muted"> · {e.kind}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
