import type { Metadata } from "next";
import Link from "next/link";
import { analyticsAttributes } from "@/lib/analytics/elements";

import { PublicLegalFooter } from "../_components/public-legal-footer";
import { PublicSiteHeader } from "../_components/public-site-header";
import { PUBLIC_SITE_NAME, getSiteUrl } from "@/lib/public-site-config";

const PRINT_BOOK_URL = "https://www.amazon.de/dp/B0HBLTQ9SZ";
const EBOOK_URL = "https://www.amazon.de/dp/B0HBLRJB2S";

const BOOK_DESCRIPTION =
  "Ein visuelles Wörterbuch mit 100 wichtigen Nomen aus dem Berufsalltag von Elektrikerinnen und Elektrikern.";

export const metadata: Metadata = {
  title: "Bücher",
  description:
    "Deutsch für Elektriker von Valerii Serputko: visuelles Fachwörterbuch als Printausgabe und Kindle-eBook.",
  alternates: {
    canonical: "/books",
  },
  openGraph: {
    title: `Bücher | ${PUBLIC_SITE_NAME}`,
    description:
      "Deutsch für Elektriker als Printausgabe oder Kindle-eBook entdecken.",
    url: "/books",
  },
};

function buildBooksStructuredData() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Bücher",
    url: `${siteUrl}/books`,
    inLanguage: "de",
    isPartOf: {
      "@id": `${siteUrl}/#website`,
    },
    mainEntity: {
      "@type": "Book",
      name: "Deutsch für Elektriker",
      description: BOOK_DESCRIPTION,
      inLanguage: "de",
      numberOfPages: 120,
      author: {
        "@type": "Person",
        name: "Valerii Serputko",
      },
      workExample: [
        {
          "@type": "Book",
          name: "Deutsch für Elektriker – Printausgabe",
          bookFormat: "https://schema.org/Paperback",
          isbn: "979-8188659202",
          url: PRINT_BOOK_URL,
        },
        {
          "@type": "Book",
          name: "Deutsch für Elektriker – Kindle-eBook",
          bookFormat: "https://schema.org/EBook",
          url: EBOOK_URL,
        },
      ],
    },
  };
}

const bookBenefits = [
  "100 wichtige Nomen aus dem Berufsalltag",
  "Artikel, Pluralform und fünf Beispielsätze zu jedem Wort",
  "Visuelle Darstellungen zum leichteren Verstehen und Merken",
  "Mehrsprachige Übersetzungshilfe für selbstständiges Lernen",
] as const;

const formats = [
  {
    title: "Printausgabe",
    analyticsId: "book_print",
    eyebrow: "120 Seiten · Taschenbuch",
    description:
      "Zum Markieren, Nachschlagen und Lernen ohne Bildschirm.",
    href: PRINT_BOOK_URL,
    cta: "Printausgabe bei Amazon ansehen",
  },
  {
    title: "Kindle-eBook",
    analyticsId: "book_ebook",
    eyebrow: "Digital lesen",
    description:
      "Die digitale Ausgabe für Kindle-Geräte und die Kindle-App.",
    href: EBOOK_URL,
    cta: "Kindle-eBook bei Amazon ansehen",
  },
] as const;

export default function BooksPage() {
  return (
    <>
      <PublicSiteHeader sectionLinkPrefix="/" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,209,102,0.13),transparent_28%),linear-gradient(180deg,#020617_0%,#07111f_42%,#0b1220_100%)] text-slate-100">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/"
                  className="rounded-sm transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Startseite
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-600">
                ›
              </li>
              <li aria-current="page" className="font-medium text-slate-200">
                Bücher
              </li>
            </ol>
          </nav>

          <section className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.28fr)] lg:items-center">
            <div className="mx-auto w-full max-w-sm lg:mx-0" aria-hidden="true">
              <div className="relative aspect-[4/5] overflow-hidden rounded-r-[30px] rounded-l-lg border border-amber-200/25 bg-[linear-gradient(145deg,#f8d46b_0%,#ffd166_45%,#e5a937_100%)] p-7 text-[#07111f] shadow-[0_32px_90px_rgba(0,0,0,0.45)] before:absolute before:inset-y-0 before:left-0 before:w-3 before:bg-black/15 sm:p-9">
                <div className="flex h-full flex-col pl-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#27364a]">
                    Visuelles Wörterbuch
                  </p>
                  <p className="mt-8 text-4xl font-bold leading-[1.03] sm:text-5xl">
                    Deutsch für Elektriker
                  </p>
                  <div className="my-auto grid grid-cols-3 gap-3 py-8">
                    {["der", "die", "das"].map((article) => (
                      <span
                        key={article}
                        className="flex aspect-square items-center justify-center rounded-2xl border border-[#07111f]/15 bg-white/35 text-sm font-bold"
                      >
                        {article}
                      </span>
                    ))}
                  </div>
                  <p className="border-t border-[#07111f]/20 pt-4 text-sm font-semibold">
                    Valerii Serputko
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
                Bücher von Valerii Serputko
              </p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
                Deutsch für Elektriker
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                {BOOK_DESCRIPTION} Jedes Wort wird mit Artikel, Pluralform, praxisnahen
                Beispielsätzen und einer visuellen Darstellung erklärt.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
                Für Elektrikerinnen und Elektriker, Auszubildende sowie alle, die Deutsch für
                den Beruf lernen möchten.
              </p>

              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {bookBenefits.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-6 text-slate-200"
                  >
                    <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#4DE2C6]" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="book-formats-heading" className="py-6 sm:py-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#4DE2C6]">Ein Buch, zwei Formate</p>
                <h2 id="book-formats-heading" className="mt-2 text-2xl font-semibold text-white sm:text-4xl">
                  Wähle deine Ausgabe
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">
                Beide Links führen zur jeweiligen Produktseite bei Amazon. Preise und
                Verfügbarkeit werden dort aktuell angezeigt.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {formats.map((format) => (
                <article
                  key={format.title}
                  className="flex min-w-0 flex-col rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.3)] backdrop-blur-xl sm:p-7"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
                    {format.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{format.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-slate-300">
                    {format.description}
                  </p>
                  <a
                    href={format.href}
                    {...analyticsAttributes(format.analyticsId, "books")}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${format.cta} (öffnet in einem neuen Tab)`}
                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FFD166] px-5 py-2.5 text-center text-sm font-semibold text-[#07111f] transition hover:bg-[#ffe099] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {format.cta}
                    <span aria-hidden="true" className="ml-2">
                      ↗
                    </span>
                  </a>
                </article>
              ))}
            </div>
          </section>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildBooksStructuredData()).replace(/</g, "\\u003c"),
            }}
          />
          <PublicLegalFooter variant="dark" />
        </div>
      </main>
    </>
  );
}
