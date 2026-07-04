"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Person, Relationship, Tree } from "@/lib/types";
import TreeView from "@/components/tree-view/TreeView";
import { useI18n } from "@/lib/i18n";

/** A print/PDF-friendly poster of the whole tree. Use the browser's
 *  Print dialog (⌘/Ctrl-P) and "Save as PDF" for a shareable keepsake. */
export default function PrintPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const treeId = Number(params.treeId);

  const [tree, setTree] = useState<Tree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [rels, setRels] = useState<Relationship[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api.getTree(treeId),
      api.listPeople(treeId),
      api.listRelationships(treeId),
    ]).then(([t, p, r]) => {
      setTree(t);
      setPeople(p);
      setRels(r);
    });
  }, [treeId, router]);

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button onClick={() => router.push(`/trees/${treeId}`)}>{t("print.back")}</button>
        <span className="muted">{t("print.tip")}</span>
        <button className="primary" onClick={() => window.print()}>{t("print.printSave")}</button>
      </div>

      <div className="print-sheet">
        <header className="print-head">
          <div className="eyebrow">{t("print.familyTree")}</div>
          <h1 style={{ margin: "0.2rem 0" }}>{tree?.name ?? "…"}</h1>
          <div className="muted">{t("print.generated", { count: people.length, date: today })}</div>
        </header>

        <div className="print-canvas">
          <TreeView people={people} relationships={rels} />
        </div>

        <footer className="print-foot muted">{t("print.madeWith")}</footer>
      </div>
    </div>
  );
}
