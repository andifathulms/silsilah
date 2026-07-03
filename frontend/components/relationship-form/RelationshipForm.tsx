"use client";

import { useState } from "react";
import type { Person, RelationshipType } from "@/lib/types";

interface Props {
  people: Person[];
  /** Optional person to prefill as one side of the relationship. */
  anchorId?: number;
  onSubmit: (body: {
    type: RelationshipType;
    person_a: number;
    person_b: number;
    start_date?: string | null;
    end_date?: string | null;
    is_biological?: boolean;
  }) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Create a parent_child or spouse edge between two existing people. For
 * parent_child, person_a is the parent and person_b the child — the labels
 * make that explicit so the direction is never ambiguous.
 */
export default function RelationshipForm({
  people,
  anchorId,
  onSubmit,
  onCancel,
}: Props) {
  const [type, setType] = useState<RelationshipType>("parent_child");
  const [personA, setPersonA] = useState<number | "">(anchorId ?? "");
  const [personB, setPersonB] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isBiological, setIsBiological] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (personA === "" || personB === "") {
      setError("Pick both people.");
      return;
    }
    if (personA === personB) {
      setError("A person cannot relate to themselves.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        type,
        person_a: Number(personA),
        person_b: Number(personB),
        start_date: type === "spouse" ? startDate || null : null,
        end_date: type === "spouse" ? endDate || null : null,
        is_biological: type === "parent_child" ? isBiological : true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const labelA = type === "parent_child" ? "Parent" : "Person 1";
  const labelB = type === "parent_child" ? "Child" : "Person 2";

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Relationship type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RelationshipType)}
        >
          <option value="parent_child">Parent → Child</option>
          <option value="spouse">Spouse</option>
        </select>
      </div>
      <div className="field">
        <label>{labelA}</label>
        <select
          value={personA}
          onChange={(e) => setPersonA(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select…</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>{labelB}</label>
        <select
          value={personB}
          onChange={(e) => setPersonB(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select…</option>
          {sorted.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {type === "parent_child" && (
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={isBiological}
              onChange={(e) => setIsBiological(e.target.checked)}
            />
            Biological (uncheck for adopted)
          </label>
        </div>
      )}

      {type === "spouse" && (
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Married</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Ended (divorce/death)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add relationship"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
