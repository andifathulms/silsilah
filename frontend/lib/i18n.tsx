"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Locale = "en" | "id";

const STORAGE_KEY = "silsilah_locale";

type Dict = Record<string, string>;

// Flat dot-keyed dictionaries. Only high-visibility surfaces are translated so
// far — this is the groundwork; deeper panels can be filled in incrementally.
const en: Dict = {
  "brand.gloss": "your family lineage",

  "nav.myTrees": "My trees",
  "nav.logout": "Log out",
  "nav.account": "Account",

  "login.gloss": "Silsilah · your family lineage",
  "login.heroTitle": "Every family has a story.",
  "login.heroAccent": "Start telling yours.",
  "login.heroSub":
    "A living family tree for the people you love — map generations, preserve photos and memories, and rediscover how you're all connected.",
  "login.f1t": "Every branch, in one place",
  "login.f1x": "Remarriages, adoptions, half-siblings — real families, not rigid templates.",
  "login.f2t": "Build it together",
  "login.f2x": "Invite relatives to view or contribute. Roles keep everyone in sync.",
  "login.f3t": "Private by default",
  "login.f3x": "Details of living relatives stay hidden unless you choose to share.",
  "login.heroFoot": "Trusted for families of 2 to 500+ · Private, invite-only trees",
  "login.welcome": "Welcome back",
  "login.createAccount": "Create your account",
  "login.subLogin": "Pick up where your family left off.",
  "login.subRegister": "It takes less than a minute to begin.",
  "login.tabLogin": "Log in",
  "login.tabSignup": "Sign up",
  "login.username": "Username",
  "login.email": "Email",
  "login.password": "Password",
  "login.btnLogin": "Log in",
  "login.btnRegister": "Create account",
  "login.busy": "Just a moment…",
  "login.demoHint": "Just exploring?",
  "login.demoBtn": "Use demo account →",

  "home.greetMorning": "Good morning",
  "home.greetAfternoon": "Good afternoon",
  "home.greetEvening": "Good evening",
  "home.title": "Your family trees",
  "home.subtitle":
    "Each tree is a private space for one family. Open one to keep growing it, or plant a new one below.",
  "home.plantNew": "Plant a new tree",
  "home.placeholder": "e.g. The Rahman Family",
  "home.createTree": "Create tree",
  "home.creating": "Creating…",
  "home.member": "member",
  "home.members": "members",
  "home.shared": "shared",
  "home.openTree": "Open tree →",
  "home.emptyTitle": "No trees yet",
  "home.emptyText":
    "Create your first tree above and add the people you love — you can connect them later.",
  "home.loading": "Loading…",

  "tree.crumbMyTrees": "My trees",
  "tree.people": "{count} people",
  "tree.places": "Places",
  "tree.print": "Print",
  "tree.addPerson": "Add person",
  "tree.connect": "Connect",
  "tree.data": "Data",
  "tree.members": "Members",
  "tree.share": "Share",
  "tree.hint": "Click a person to focus · drag to pan · scroll to zoom",
};

const id: Dict = {
  "brand.gloss": "kisah keluargamu",

  "nav.myTrees": "Pohon saya",
  "nav.logout": "Keluar",
  "nav.account": "Akun",

  "login.gloss": "Silsilah · kisah keluargamu",
  "login.heroTitle": "Setiap keluarga punya cerita.",
  "login.heroAccent": "Mulai ceritakan milikmu.",
  "login.heroSub":
    "Pohon keluarga yang hidup untuk orang-orang tersayang — petakan generasi, simpan foto dan kenangan, dan temukan kembali hubungan kalian.",
  "login.f1t": "Setiap cabang, dalam satu tempat",
  "login.f1x": "Pernikahan kembali, adopsi, saudara tiri — keluarga nyata, bukan template kaku.",
  "login.f2t": "Bangun bersama",
  "login.f2x": "Undang kerabat untuk melihat atau berkontribusi. Peran menjaga semua tetap selaras.",
  "login.f3t": "Privat secara bawaan",
  "login.f3x": "Detail kerabat yang masih hidup tetap tersembunyi kecuali kamu memilih membagikannya.",
  "login.heroFoot": "Untuk keluarga 2 hingga 500+ orang · Pohon privat, khusus undangan",
  "login.welcome": "Selamat datang kembali",
  "login.createAccount": "Buat akun kamu",
  "login.subLogin": "Lanjutkan dari mana keluargamu berhenti.",
  "login.subRegister": "Kurang dari semenit untuk memulai.",
  "login.tabLogin": "Masuk",
  "login.tabSignup": "Daftar",
  "login.username": "Nama pengguna",
  "login.email": "Email",
  "login.password": "Kata sandi",
  "login.btnLogin": "Masuk",
  "login.btnRegister": "Buat akun",
  "login.busy": "Sebentar…",
  "login.demoHint": "Cuma lihat-lihat?",
  "login.demoBtn": "Pakai akun demo →",

  "home.greetMorning": "Selamat pagi",
  "home.greetAfternoon": "Selamat siang",
  "home.greetEvening": "Selamat malam",
  "home.title": "Pohon keluarga kamu",
  "home.subtitle":
    "Setiap pohon adalah ruang privat untuk satu keluarga. Buka untuk terus menumbuhkannya, atau tanam yang baru di bawah.",
  "home.plantNew": "Tanam pohon baru",
  "home.placeholder": "mis. Keluarga Rahman",
  "home.createTree": "Buat pohon",
  "home.creating": "Membuat…",
  "home.member": "anggota",
  "home.members": "anggota",
  "home.shared": "dibagikan",
  "home.openTree": "Buka pohon →",
  "home.emptyTitle": "Belum ada pohon",
  "home.emptyText":
    "Buat pohon pertamamu di atas dan tambahkan orang-orang tersayang — kamu bisa menghubungkan mereka nanti.",
  "home.loading": "Memuat…",

  "tree.crumbMyTrees": "Pohon saya",
  "tree.people": "{count} orang",
  "tree.places": "Tempat",
  "tree.print": "Cetak",
  "tree.addPerson": "Tambah orang",
  "tree.connect": "Hubungkan",
  "tree.data": "Data",
  "tree.members": "Anggota",
  "tree.share": "Bagikan",
  "tree.hint": "Klik seseorang untuk fokus · seret untuk geser · gulir untuk perbesar",
};

const DICTS: Record<Locale, Dict> = { en, id };

export const LOCALE_LABELS: Record<Locale, string> = { en: "EN", id: "ID" };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start "en" to match SSR, then adopt the stored locale on mount.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "en" || saved === "id") setLocaleState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      interpolate(DICTS[locale][key] ?? en[key] ?? key, vars),
    [locale]
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so components render even outside a provider (e.g. tests).
    return {
      locale: "en",
      setLocale: () => {},
      t: (key, vars) => interpolate(en[key] ?? key, vars),
    };
  }
  return ctx;
}
