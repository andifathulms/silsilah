"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LifeEvent, LifeEventType, Person } from "@/lib/types";

const EVENT_META: Record<LifeEventType, { icon: string; label: string }> = {
  birth: { icon: "👶", label: "Birth" },
  marriage: { icon: "💍", label: "Marriage" },
  death: { icon: "🕊", label: "Death" },
  education: { icon: "🎓", label: "Education" },
  career: { icon: "💼", label: "Career" },
  residence: { icon: "🏠", label: "Residence" },
  immigration: { icon: "✈️", label: "Migration" },
  military: { icon: "🎖", label: "Military" },
  religious: { icon: "🕌", label: "Religious" },
  other: { icon: "⭐", label: "Event" },
};

interface Props {
  treeId: number;
  person: Person;
  canEdit: boolean;
  redacted?: boolean;
}

/**
 * Auto-composes a life timeline: the person's birth and death from their core
 * fields, plus any custom LifeEvents — all sorted chronologically.
 */
export default function LifeTimeline({ treeId, person, canEdit, redacted }: Props) {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      setEvents(await api.listEvents(treeId, person.id));
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, person.id]);

  // Merge implicit birth/death with explicit events, sorted by date.
  type Row = { key: string; icon: string; label: string; date: string | null; place?: string; description?: string; id?: number };
  const rows: Row[] = [];
  if (person.birth_date)
    rows.push({ key: "b", icon: "👶", label: "Born", date: person.birth_date });
  for (const e of events)
    rows.push({
      key: `e${e.id}`,
      icon: EVENT_META[e.type].icon,
      label: e.title || e.type_display,
      date: e.date,
      place: e.place,
      description: e.description,
      id: e.id,
    });
  if (person.death_date)
    rows.push({ key: "d", icon: "🕊", label: "Died", date: person.death_date });

  rows.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  async function remove(id: number) {
    if (!confirm("Delete this event?")) return;
    await api.deleteEvent(treeId, person.id, id);
    await load();
  }

  return (
    <div>
      {redacted && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          🔒 Timeline is hidden for living people at your access level.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No life events recorded yet.</p>
      ) : (
        <div className="lifeline">
          {rows.map((r) => (
            <div key={r.key} className="lifeline-item">
              <div className="lifeline-icon">{r.icon}</div>
              <div className="lifeline-body">
                <div className="row spread" style={{ gap: "0.5rem" }}>
                  <strong>{r.label}</strong>
                  <span className="muted" style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {r.date ? formatDate(r.date) : ""}
                  </span>
                </div>
                {r.place && <div className="muted" style={{ fontSize: "0.85rem" }}>📍 {r.place}</div>}
                {r.description && <div style={{ fontSize: "0.9rem", marginTop: "0.15rem" }}>{r.description}</div>}
              </div>
              {canEdit && r.id != null && (
                <button className="sm ghost" onClick={() => remove(r.id!)} title="Delete">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        adding ? (
          <EventForm
            onCancel={() => setAdding(false)}
            onSave={async (body) => {
              await api.createEvent(treeId, person.id, body);
              setAdding(false);
              await load();
            }}
          />
        ) : (
          <button style={{ marginTop: "0.85rem" }} onClick={() => setAdding(true)}>
            ＋ Add life event
          </button>
        )
      )}
    </div>
  );
}

function EventForm({
  onSave,
  onCancel,
}: {
  onSave: (body: Partial<LifeEvent>) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<LifeEventType>("residence");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({ type, title, date: date || null, place, description });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="upload-box" style={{ marginTop: "0.85rem" }}>
      <div className="row wrap" style={{ gap: "0.5rem" }}>
        <select value={type} onChange={(e) => setType(e.target.value as LifeEventType)} style={{ width: "auto" }}>
          {Object.entries(EVENT_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
      </div>
      <div className="field" style={{ marginTop: "0.5rem" }}>
        <input placeholder="Title (e.g. Graduated university)" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <input placeholder="Place (e.g. Jakarta, Indonesia)" value={place} onChange={(e) => setPlace(e.target.value)} />
      </div>
      <div className="field">
        <textarea rows={2} placeholder="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add event"}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
