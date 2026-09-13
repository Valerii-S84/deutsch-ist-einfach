import Link from "next/link";
import { analyticsAttributes } from "@/lib/analytics/elements";
import type { Metadata } from "next";

import { PublicLegalFooter } from "../_components/public-legal-footer";
import { PublicSiteHeader } from "../_components/public-site-header";
import {
  PUBLIC_SITE_NAME,
  getTelegramBotUrl,
} from "@/lib/public-site-config";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Lernangebote",
  description:
    "Deutsch lernen mit Quiz-Bot, verständlichen Wissensartikeln und persönlicher Orientierung zur passenden Lernform.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: `Lernangebote | ${PUBLIC_SITE_NAME}`,
    description:
      "Wähle zwischen kurzen Quizrunden, fundiertem Sprachwissen und einer unverbindlichen Anfrage zur Lernbegleitung.",
    url: "/projects",
  },
};

const telegramBotUrl = getTelegramBotUrl();

const learningOffers = [
  {
    eyebrow: "Üben",
    name: "Quiz-Bot",
    analyticsId: "telegram_bot",
    description:
      "Trainiere regelmäßig mit kurzen Quizrunden, Duellen und direktem Feedback in Telegram.",
    href: telegramBotUrl,
    cta: "Quiz-Bot öffnen",
    external: true,
  },
  {
    eyebrow: "Verstehen",
    name: "Wissen & Tipps",
    analyticsId: "nav_wissen",
    description:
      "Lies redaktionell geprüfte Artikel zu Sprachniveaus, Deutschprüfungen und Sprachgeschichte.",
    href: "/wissen",
    cta: "Artikel entdecken",
    external: false,
  },
  {
    eyebrow: "Orientierung",
    name: "Lernbegleitung",
    analyticsId: "nav_learning",
    description:
      "Teile uns Niveau, Ziel und Zeitplan mit. Wir prüfen, welcher nächste Lernschritt sinnvoll sein kann.",
    href: "/contact#lernbegleitung",
    cta: "Lernanfrage starten",
    external: false,
  },
] as const;

export default function ProjectsPage() {
  return (
    <>
      <PublicSiteHeader sectionLinkPrefix="/" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,209,102,0.11),transparent_28%),linear-gradient(180deg,#020617_0%,#07111f_42%,#0b1220_100%)] text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link className="transition hover:text-amber-200" href="/">
                  Startseite
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-600">
                ›
              </li>
              <li aria-current="page" className="font-medium text-slate-200">
                Lernangebote
              </li>
            </ol>
          </nav>

          <section className="py-12 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
              Lernangebote
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Finde den Einstieg, der zu deinem Lernziel passt.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              Übe in kurzen Einheiten, vertiefe dein Sprachwissen oder frage eine persönliche
              Orientierung an. Du entscheidest, womit du beginnen möchtest.
            </p>
          </section>

          <section aria-labelledby="learning-offers-heading">
            <h2 id="learning-offers-heading" className="sr-only">
              Alle Lernangebote
            </h2>
            <div className="grid gap-5 lg:grid-cols-3">
              {learningOffers.map((offer) => {
                const cardContent = (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
                      {offer.eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-white">{offer.name}</h3>
                    <p className="mt-4 flex-1 text-sm leading-7 text-slate-300">
                      {offer.description}
                    </p>
                    <span className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 px-5 py-2.5 text-sm font-semibold text-[#B9FFF2] transition group-hover:bg-[#4DE2C6]/20">
                      {offer.cta} →
                    </span>
                  </>
                );

                const className =
                  "group flex min-w-0 flex-col rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.32)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20";

                return offer.external ? (
                  <a
                    key={offer.name}
                    href={offer.href} {...analyticsAttributes(offer.analyticsId, "projects")}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <Link key={offer.name} href={offer.href} {...analyticsAttributes(offer.analyticsId, "projects")} className={className}>
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          </section>

          <PublicLegalFooter variant="dark" />
        </div>
      </main>
    </>
  );
}
