"use client";

import { useRef, useState } from "react";
import { api, downloadGedcom } from "@/lib/api";

interface Props {
  treeId: number;
  treeName: string;
  onImported: () => void;
}

/** GEDCOM import/export — move a tree in or out of Silsilah. */
export default function DataPanel({ treeId, treeName, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportGed() {
    setError(null);
    try {
      await downloadGedcom(treeId, treeName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function importGed(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .ged file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await api.importGedcom(treeId, file);
      setMsg(
        `Imported ${res.people_imported} people and ${res.relationships_imported} relationships` +
          (res.skipped ? ` (${res.skipped} skipped)` : "") +
          "."
      );
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h4 style={{ marginTop: 0 }}>⬇ Export</h4>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Download this tree as a standard <strong>GEDCOM</strong> (.ged) file — works
        with Ancestry, FamilySearch, Gramps, and more.
      </p>
      <button className="primary" onClick={exportGed}>Download GEDCOM</button>

      <div className="divider" />

      <h4 style={{ marginTop: 0 }}>⬆ Import</h4>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Add people and relationships from a GEDCOM file into this tree. Existing
        people are kept — imported records are appended.
      </p>
      <form onSubmit={importGed}>
        <input ref={fileRef} type="file" accept=".ged,text/plain" />
        <button className="primary" type="submit" disabled={busy} style={{ marginTop: "0.6rem" }}>
          {busy ? "Importing…" : "Import GEDCOM"}
        </button>
      </form>

      {msg && <div className="rel-result" style={{ marginTop: "1rem" }}><span className="rel-result-icon">✅</span><span>{msg}</span></div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
