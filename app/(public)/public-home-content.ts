export const BOT_LOGO_PATH = "/logo/bot-logo.jpg";
export const CHANNEL_LOGO_PATH = "/logo/channel-logo.jpg";
export const DEUTSCH_TRAINER_LOGO_PATH = "/logo/deutsch-trainer-logo.png";
export const WORKLOG_LOGO_PATH = "/products/worklog/logo.png";
export const WORKLOG_DOWNLOAD_PATH = "/downloads/worklog/direct-hoofdrapport.apk";

export const GLASS_CARD_CLASS =
  "rounded-2xl border border-white/10 bg-white/[0.07] shadow-[0_18px_54px_rgba(0,0,0,0.26)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.09] sm:rounded-3xl sm:shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

export const ORANGE_BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-full bg-[#2AABEE] px-5 py-2.5 text-center text-sm font-semibold leading-snug text-white shadow-[0_14px_28px_rgba(42,171,238,0.28)] transition hover:bg-[#169bdc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 max-w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-center text-sm font-semibold leading-snug text-white transition hover:border-[#FFD166]/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]";

export const WISSEN_ARTICLES = [
  {
    slug: "deutsche-sprache-geschichte",
    category: "Sprachgeschichte",
    title: "Geschichte der deutschen Sprache",
    description:
      "Wie Deutsch entstanden ist, welche Sprachstufen wichtig sind und warum Sprache sich bis heute bewegt.",
  },
  {
    slug: "sprachniveaus-a0-c2",
    category: "Lernniveaus",
    title: "Sprachniveaus A0–C2: der Lernweg",
    description:
      "Orientierung von Pre-A1 bis C2: Kompetenzen, Lernziele, Zeitkorridore und passende Prüfungen.",
  },
  {
    slug: "pruefungen-goethe-telc-testdaf",
    category: "Prüfung",
    title: "Prüfungen: Goethe / telc / TestDaF",
    description:
      "Die wichtigsten Prüfungsformate im Vergleich, mit Blick auf Struktur und erste Orientierung.",
  },
] as const;
