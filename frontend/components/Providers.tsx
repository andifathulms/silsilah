"use client";

import { I18nProvider } from "@/lib/i18n";

/** Client-side app providers (i18n today; room to grow). */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
