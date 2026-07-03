"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import type { Person, Relationship, Tree } from "@/lib/types";
import TreeView from "@/components/tree-view/TreeView";

/** A print/PDF-friendly poster of the whole tree. Use the browser's
 *  Print dialog (⌘/Ctrl-P) and "Save as PDF" for a shareable keepsake. */
export default function PrintPage() {
  const params = useParams();
  const router = useRouter();
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
        <button onClick={() => router.push(`/trees/${treeId}`)}>← Back</button>
        <span className="muted">Tip: choose “Save as PDF” in the print dialog for a keepsake.</span>
        <button className="primary" onClick={() => window.print()}>🖨 Print / Save PDF</button>
      </div>

      <div className="print-sheet">
        <header className="print-head">
          <div className="eyebrow">Family Tree</div>
          <h1 style={{ margin: "0.2rem 0" }}>{tree?.name ?? "…"}</h1>
          <div className="muted">{people.length} people · generated {today}</div>
        </header>

        <div className="print-canvas">
          <TreeView people={people} relationships={rels} />
        </div>

        <footer className="print-foot muted">🌳 Made with Silsilah</footer>
      </div>
    </div>
  );
}
