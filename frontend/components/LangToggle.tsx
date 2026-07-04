"use client";

import { LOCALE_LABELS, useI18n } from "@/lib/i18n";

/** Compact EN/ID language switch. */
export default function LangToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          className={locale === l ? "active" : ""}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
