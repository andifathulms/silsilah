"use client";

import { useRef, useState } from "react";
import { api, downloadGedcom } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Props {
  treeId: number;
  treeName: string;
  onImported: () => void;
}

/** GEDCOM import/export — move a tree in or out of Silsilah. */
export default function DataPanel({ treeId, treeName, onImported }: Props) {
  const { t } = useI18n();
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
      setError(t("data.chooseFile"));
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await api.importGedcom(treeId, file);
      setMsg(
        t("data.imported", {
          p: res.people_imported,
          r: res.relationships_imported,
          skipped: res.skipped ? t("data.skipped", { n: res.skipped }) : "",
        })
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
      <h4 style={{ marginTop: 0 }}>{t("data.export")}</h4>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>{t("data.exportDesc")}</p>
      <button className="primary" onClick={exportGed}>{t("data.downloadGedcom")}</button>

      <div className="divider" />

      <h4 style={{ marginTop: 0 }}>{t("data.import")}</h4>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>{t("data.importDesc")}</p>
      <form onSubmit={importGed}>
        <input ref={fileRef} type="file" accept=".ged,text/plain" />
        <button className="primary" type="submit" disabled={busy} style={{ marginTop: "0.6rem" }}>
          {busy ? t("data.importing") : t("data.importBtn")}
        </button>
      </form>

      {msg && <div className="rel-result" style={{ marginTop: "1rem" }}><span className="rel-result-icon">✅</span><span>{msg}</span></div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
