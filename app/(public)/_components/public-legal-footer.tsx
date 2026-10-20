import Link from "next/link";

import { PUBLIC_SITE_NAME } from "@/lib/public-site-config";

type PublicLegalFooterProps = {
  variant?: "light" | "dark";
};

export function PublicLegalFooter({ variant = "light" }: PublicLegalFooterProps) {
  const isDark = variant === "dark";
  const borderClass = isDark ? "border-white/10" : "border-slate-200";
  const textClass = isDark ? "text-slate-400" : "text-slate-600";
  const hoverClass = isDark ? "hover:text-white" : "hover:text-slate-900";
  const ringOffsetClass = isDark ? "focus-visible:ring-offset-slate-950" : "focus-visible:ring-offset-white";

  return (
    <footer className={`mt-10 border-t ${borderClass} pt-6 text-sm ${textClass}`}>
      <p>© 2026 {PUBLIC_SITE_NAME}</p>
      <nav aria-label="Footer-Navigation" className="mt-3 flex flex-wrap gap-3">
        <Link
          href="/"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Startseite
        </Link>
        <Link
          href="/projects"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Lernangebote
        </Link>
        <Link
          href="/wissen"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Wissen &amp; Tipps
        </Link>
        <Link
          href="/impressum"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Impressum
        </Link>
        <Link
          href="/privacy"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Datenschutz
        </Link>
        <Link
          href="/contact"
          className={`transition ${hoverClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${ringOffsetClass}`}
        >
          Kontakt
        </Link>
      </nav>
    </footer>
  );
}
