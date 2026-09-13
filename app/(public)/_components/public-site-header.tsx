"use client";

import Image from "next/image";
import Link from "next/link";
import { analyticsAttributes } from "@/lib/analytics/elements";
import { useEffect, useId, useRef, useState } from "react";

import { usePublicAnalytics } from "@/app/analytics-provider";
import {
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_NAME,
  TELEGRAM_BOT_START_PAYLOAD,
  getTelegramBotUrl,
} from "@/lib/public-site-config";
import { buildTrackedTelegramBotUrl } from "../public-home-helpers";

type PublicSiteHeaderProps = {
  sectionLinkPrefix?: "" | "/";
  trackedTelegramBotUrl?: string;
};

const publicNavigation = [
  { homeHref: "#projects", siteHref: "/projects", id: "nav_projects", label: "Lernangebote" },
  { homeHref: "#knowledge", siteHref: "/wissen", id: "nav_wissen", label: "Wissen & Tipps" },
  { homeHref: "#unterricht", siteHref: "/contact#lernbegleitung", id: "nav_learning", label: "Lernbegleitung" },
  { homeHref: "/contact", siteHref: "/contact", id: "nav_contact", label: "Kontakt" },
];

const LINK_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]";
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function getTrackedTelegramBotFallback(): string {
  return buildTrackedTelegramBotUrl(getTelegramBotUrl(), TELEGRAM_BOT_START_PAYLOAD);
}

export function PublicSiteHeader({
  sectionLinkPrefix = "",
  trackedTelegramBotUrl,
}: PublicSiteHeaderProps = {}) {
  const headerCtaUrl = trackedTelegramBotUrl ?? getTrackedTelegramBotFallback();
  const { trackEvent } = usePublicAnalytics();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileNavigationId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const closeAtDesktopBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    desktopMediaQuery.addEventListener("change", closeAtDesktopBreakpoint);
    return () => {
      desktopMediaQuery.removeEventListener("change", closeAtDesktopBreakpoint);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileMenuOpen]);

  const trackHeaderCta = (placement = "header") =>
    trackEvent("hero_cta_click", {
      section: placement,
      cta: "telegram_bot",
      destination: "telegram",
    });

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-white/10 bg-[#07111f]/[0.94] backdrop-blur-xl"
    >
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-3 sm:px-6 lg:h-auto lg:gap-3 lg:py-3">
        <Link
          href="/"
          {...analyticsAttributes("nav_home", "header")}
          className={`flex min-w-0 items-center gap-3 rounded-xl lg:rounded-2xl ${LINK_FOCUS_CLASS}`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <span
            aria-hidden="true"
            className="relative h-10 w-[3.25rem] shrink-0 overflow-hidden rounded-xl border border-[#F6C453]/60 bg-[linear-gradient(145deg,#FFFDF7_0%,#FFF8E7_52%,#FFF1C7_100%)] shadow-[0_8px_20px_rgba(246,196,83,0.16)] lg:h-16 lg:w-20 lg:rounded-2xl lg:shadow-[0_12px_30px_rgba(246,196,83,0.18)]"
          >
            <Image
              src={PUBLIC_SITE_LOGO_PATH}
              alt=""
              fill
              sizes="(min-width: 1024px) 80px, 52px"
              className="object-contain p-1"
            />
          </span>
          <span className="sr-only min-w-0 text-base font-bold leading-tight text-white lg:not-sr-only">
            {PUBLIC_SITE_NAME}
          </span>
        </Link>

        <button
          ref={menuButtonRef}
          {...analyticsAttributes("nav_menu", "header_mobile")}
          type="button"
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:border-white/25 hover:bg-white/[0.1] lg:hidden ${LINK_FOCUS_CLASS}`}
          aria-label={isMobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
          aria-controls={mobileNavigationId}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
        >
          <span className="relative block h-5 w-6" aria-hidden="true">
            <span
              className={`absolute left-0 top-0.5 h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ${
                isMobileMenuOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[0.5625rem] h-0.5 w-6 rounded-full bg-current transition-opacity duration-200 ${
                isMobileMenuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute bottom-0.5 left-0 h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ${
                isMobileMenuOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </span>
        </button>

        <div className="hidden min-w-0 items-center justify-end gap-3 lg:flex">
          <nav
            aria-label="Hauptnavigation"
            className="flex min-w-0 flex-wrap gap-2 text-sm text-slate-300"
          >
            {publicNavigation.map((item) => (
              <a
                key={item.homeHref}
                href={sectionLinkPrefix ? item.siteHref : item.homeHref}
                {...analyticsAttributes(item.id, "header")}
                className={`rounded-full border border-transparent px-3 py-2 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white ${LINK_FOCUS_CLASS}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href={headerCtaUrl}
            {...analyticsAttributes("telegram_bot", "header", true)}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center justify-center rounded-full bg-[#2AABEE] px-4 py-2 text-center text-sm font-semibold leading-snug text-white shadow-[0_12px_26px_rgba(42,171,238,0.28)] transition hover:bg-[#169bdc] ${LINK_FOCUS_CLASS}`}
            onClick={() => trackHeaderCta()}
          >
            Quiz-Bot öffnen
          </a>
        </div>

        <div
          id={mobileNavigationId}
          className={`absolute inset-x-0 top-full border-t border-white/10 bg-[#07111f] px-3 pb-4 pt-3 shadow-[0_20px_35px_rgba(0,0,0,0.38)] sm:px-6 lg:hidden ${
            isMobileMenuOpen ? "block" : "hidden"
          }`}
        >
          <nav aria-label="Mobile Hauptnavigation" className="grid gap-1 text-sm text-slate-200">
            {publicNavigation.map((item) => (
              <a
                key={item.homeHref}
                href={sectionLinkPrefix ? item.siteHref : item.homeHref}
                {...analyticsAttributes(item.id, "header_mobile")}
                className={`flex min-h-11 items-center rounded-xl px-3 py-2.5 transition hover:bg-white/[0.07] hover:text-white ${LINK_FOCUS_CLASS}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href={headerCtaUrl}
            {...analyticsAttributes("telegram_bot", "header_mobile", true)}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2AABEE] px-4 py-2 text-center text-sm font-semibold leading-snug text-white shadow-[0_12px_26px_rgba(42,171,238,0.24)] transition hover:bg-[#169bdc] ${LINK_FOCUS_CLASS}`}
            onClick={() => {
              setIsMobileMenuOpen(false);
              trackHeaderCta("header_mobile");
            }}
          >
            Quiz-Bot öffnen
          </a>
        </div>
      </div>
    </header>
  );
}
