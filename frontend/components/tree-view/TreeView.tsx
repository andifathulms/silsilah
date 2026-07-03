"use client";

import { useEffect, useRef } from "react";
import type { Person, Relationship } from "@/lib/types";
import { toFamilyChartData } from "@/lib/family-chart-adapter";
import "family-chart/styles/family-chart.css";

interface Props {
  people: Person[];
  relationships: Relationship[];
  /** Person to center the layout on ("show me my branch"). */
  mainId?: number | null;
  onSelect?: (personId: number) => void;
}

/**
 * Thin wrapper around the `family-chart` library. It owns the imperative chart
 * instance; React just feeds it the adapted data and forwards card clicks up.
 * The library is loaded dynamically because it needs the DOM (no SSR).
 */
export default function TreeView({
  people,
  relationships,
  mainId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function render() {
      const mod = await import("family-chart");
      const f3 = mod.default;
      if (cancelled || !containerRef.current) return;

      const data = toFamilyChartData(people, relationships);
      if (data.length === 0) {
        containerRef.current.innerHTML =
          '<p style="padding:2rem;color:#7a756c">No people yet. Add someone to start the tree.</p>';
        return;
      }

      // Rebuild from scratch on data change — trees here stay small enough
      // (lazy-loaded branches) that a full re-layout is acceptable.
      containerRef.current.innerHTML = "";

      const chart = f3
        .createChart(containerRef.current, data)
        .setTransitionTime(600)
        .setCardXSpacing(230)
        .setCardYSpacing(150)
        .setOrientationVertical()
        .setSingleParentEmptyCard(false);

      const card = chart
        .setCard(f3.CardHtml)
        .setCardDisplay([["first name", "last name"], ["birthday"]])
        .setCardDim({})
        .setOnCardClick((_e: unknown, d: any) => {
          const id = Number(d?.data?.id ?? d?.id);
          if (!Number.isNaN(id) && onSelect) onSelect(id);
          chart.updateMainId(String(id));
          chart.updateTree({});
        });

      if (mainId != null) {
        chart.updateMainId(String(mainId));
      }

      chartRef.current = chart;
      chart.updateTree({ initial: true });

      // Mark deceased cards so they read as departed (grayscale + dagger).
      // family-chart stamps each card div with data-id = our person id.
      const deceased = new Set(
        people.filter((p) => !p.is_living).map((p) => String(p.id))
      );
      const markDeceased = () => {
        const cards = containerRef.current?.querySelectorAll<HTMLElement>(".card[data-id]");
        cards?.forEach((el) => {
          const id = (el.getAttribute("data-id") || "").split("--")[0];
          el.classList.toggle("card-deceased", deceased.has(id));
        });
      };
      markDeceased();
      // Re-apply whenever the chart re-renders cards (pan/zoom/recenter).
      observer?.disconnect();
      observer = new MutationObserver(markDeceased);
      observer.observe(containerRef.current, { childList: true, subtree: true });

      // silence unused var lint in strict builds
      void card;
    }

    render();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [people, relationships, mainId, onSelect]);

  return (
    <div
      ref={containerRef}
      className="f3"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 480,
        background: "#fff",
        borderRadius: 10,
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    />
  );
}
