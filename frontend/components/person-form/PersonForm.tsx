"use client";

import { useState } from "react";
import type { Person } from "@/lib/types";

export interface PersonFormValues {
  name: string;
  gender: string;
  birth_date: string;
  death_date: string;
  is_living: boolean;
  notes: string;
}

interface Props {
  initial?: Partial<Person>;
  onSubmit: (values: PersonFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function PersonForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: Props) {
  const [values, setValues] = useState<PersonFormValues>({
    name: initial?.name ?? "",
    gender: initial?.gender ?? "",
    birth_date: initial?.birth_date ?? "",
    death_date: initial?.death_date ?? "",
    is_living: initial?.is_living ?? true,
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PersonFormValues>(
    key: K,
    val: PersonFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Name *</label>
        <input
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>Gender</label>
          <select
            value={values.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">Unspecified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
          <label className="check">
            <input
              type="checkbox"
              checked={values.is_living}
              onChange={(e) => set("is_living", e.target.checked)}
            />
            Living
          </label>
        </div>
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label>Birth date</label>
          <input
            type="date"
            value={values.birth_date ?? ""}
            onChange={(e) => set("birth_date", e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Death date</label>
          <input
            type="date"
            value={values.death_date ?? ""}
            onChange={(e) => set("death_date", e.target.value)}
            disabled={values.is_living}
          />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea
          rows={3}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
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
