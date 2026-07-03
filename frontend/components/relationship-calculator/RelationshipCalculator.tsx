"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Person } from "@/lib/types";

interface Props {
  treeId: number;
  person: Person;
}

/** "How is X related to me?" — pick another person, get a kinship label. */
export default function RelationshipCalculator({ treeId, person }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [otherId, setOtherId] = useState<number | "">("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listPeople(treeId).then(setPeople).catch(() => setPeople([]));
  }, [treeId]);

  async function compute(id: number) {
    setBusy(true);
    setResult(null);
    try {
      const res = await api.getRelationship(treeId, person.id, id);
      setResult(res.sentence);
    } catch {
      setResult("Couldn't work that out.");
    } finally {
      setBusy(false);
    }
  }

  const options = people
    .filter((p) => p.id !== person.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.88rem" }}>
        See how anyone in the tree is related to <strong>{person.name}</strong>.
      </p>
      <select
        value={otherId}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : "";
          setOtherId(id);
          if (id) compute(id as number);
        }}
      >
        <option value="">Choose a person…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {busy && <p className="muted" style={{ marginTop: "0.75rem" }}>Working it out…</p>}
      {result && !busy && (
        <div className="rel-result animate-in">
          <span className="rel-result-icon">🧬</span>
          <span>{result}</span>
        </div>
      )}
    </div>
  );
}
