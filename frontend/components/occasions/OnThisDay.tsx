"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Occasion } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const ICON = { birthday: "🎂", anniversary: "💍", memorial: "🕊" };
const VERB_KEY = {
  birthday: "occasion.birthday",
  anniversary: "occasion.anniversary",
  memorial: "occasion.memorial",
};

export default function OnThisDay({ treeId }: { treeId: number }) {
  const { t } = useI18n();
  const [occasions, setOccasions] = useState<Occasion[] | null>(null);

  useEffect(() => {
    api.onThisDay(treeId).then((r) => setOccasions(r.occasions)).catch(() => setOccasions([]));
  }, [treeId]);

  if (!occasions || occasions.length === 0) return null;

  const when = (days: number) =>
    days === 0 ? t("occasion.today") : days === 1 ? t("occasion.tomorrow") : t("occasion.inDays", { n: days });

  const detail = (o: Occasion) => {
    if (o.kind === "birthday" && o.turning) return t("occasion.turning", { n: o.turning });
    if (o.kind === "anniversary" && o.years) return t("occasion.years", { n: o.years });
    if (o.kind === "memorial" && o.years_ago) return t("occasion.yearsAgo", { n: o.years_ago });
    return "";
  };

  return (
    <div className="occasions animate-in">
      <span className="occasions-label">{t("occasion.comingUp")}</span>
      <div className="occasions-strip">
        {occasions.map((o, i) => (
          <Link key={i} href={`/trees/${treeId}/person/${o.person}`} className="occasion-chip">
            <span className="occasion-icon">{ICON[o.kind]}</span>
            <span>
              <strong>{o.name}</strong>
              <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                {t(VERB_KEY[o.kind])} {when(o.days_until)}
                {detail(o) ? ` · ${detail(o)}` : ""}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
