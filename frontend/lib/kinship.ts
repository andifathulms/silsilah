import type { Locale } from "./i18n";

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface RelStruct {
  kind: string; // self|spouse|ancestor|descendant|sibling|pibling|nibling|cousin|unrelated
  up: number;
  down: number;
  gender: string; // "M"|"F"|""
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Compose a localized kinship label from the backend's structured descriptor.
 *  Common depths are exact; deep/rare cases degrade to a readable fallback. */
export function kinLabel(locale: Locale, t: T, s: RelStruct): string {
  const byg = (m: string, f: string, n: string) =>
    s.gender === "M" ? t(m) : s.gender === "F" ? t(f) : t(n);
  const greatEN = (k: number) => "great-".repeat(Math.max(0, k));

  switch (s.kind) {
    case "self":
      return t("rel.self");
    case "unrelated":
      return t("rel.unrelated");
    case "spouse":
      return byg("rel.husband", "rel.wife", "rel.spouse");

    case "descendant":
      if (s.down === 1) return byg("rel.son", "rel.daughter", "rel.child");
      if (s.down === 2) return byg("rel.grandson", "rel.granddaughter", "rel.grandchild");
      if (s.down === 3) return t("rel.greatGrandchild");
      return locale === "id"
        ? t("rel.descendantN", { n: s.down })
        : greatEN(s.down - 2) + t("rel.grandchild");

    case "ancestor":
      if (s.up === 1) return byg("rel.father", "rel.mother", "rel.parent");
      if (s.up === 2) return byg("rel.grandfather", "rel.grandmother", "rel.grandparent");
      if (s.up === 3) return t("rel.greatGrandparent");
      return locale === "id"
        ? t("rel.ancestorN", { n: s.up })
        : greatEN(s.up - 2) + t("rel.grandparent");

    case "sibling":
      return byg("rel.brother", "rel.sister", "rel.sibling");

    case "pibling":
      if (s.up === 2) return byg("rel.uncle", "rel.aunt", "rel.pibling");
      if (s.up === 3) return byg("rel.granduncle", "rel.grandaunt", "rel.granduncle");
      return locale === "id"
        ? t("rel.piblingDeep")
        : greatEN(s.up - 3) + byg("rel.granduncle", "rel.grandaunt", "rel.granduncle");

    case "nibling":
      if (s.down === 2) return byg("rel.nephew", "rel.niece", "rel.nibling");
      if (s.down === 3) return byg("rel.grandnephew", "rel.grandniece", "rel.grandnephew");
      return locale === "id"
        ? t("rel.niblingDeep")
        : greatEN(s.down - 3) + byg("rel.grandnephew", "rel.grandniece", "rel.grandnephew");

    case "cousin": {
      const degree = Math.min(s.up, s.down) - 1;
      const removal = Math.abs(s.up - s.down);
      const base =
        degree === 1
          ? t("rel.cousin")
          : t("rel.cousinDeep", { ord: locale === "id" ? degree : ordinal(degree) });
      if (removal === 0) return base;
      const rem =
        removal === 1
          ? t("rel.removedOnce")
          : removal === 2
          ? t("rel.removedTwice")
          : t("rel.removedN", { n: removal });
      return `${base} ${rem}`;
    }

    default:
      return t("rel.unrelated");
  }
}

/** Full localized sentence, e.g. "X is Nadia's grandfather." */
export function kinSentence(
  locale: Locale,
  t: T,
  otherName: string,
  personName: string,
  s: RelStruct
): string {
  const label = kinLabel(locale, t, s);
  if (s.kind === "self")
    return t("rel.sentenceSelf", { other: otherName, person: personName });
  if (s.kind === "unrelated")
    return t("rel.sentenceUnrelated", { other: otherName, person: personName, label });
  return t("rel.sentence", { other: otherName, person: personName, label });
}
