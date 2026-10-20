import type { Metadata } from "next";
import Link from "next/link";

import { ARTICLE_EMBEDS, ARTICLE_SLUGS } from "@/lib/article-definitions";
import { PUBLIC_SITE_NAME, getSiteUrl } from "@/lib/public-site-config";
import { PublicLegalFooter } from "../_components/public-legal-footer";
import { PublicSiteHeader } from "../_components/public-site-header";

export const metadata: Metadata = {
  title: "Wissen & Tipps",
  description:
    "Wissensartikel über Sprachniveaus, Deutschprüfungen und die Geschichte der deutschen Sprache.",
  alternates: {
    canonical: "/wissen",
  },
  openGraph: {
    title: `Wissen & Tipps | ${PUBLIC_SITE_NAME}`,
    description:
      "Sprachniveaus verstehen, Deutschprüfungen vergleichen und die deutsche Sprachgeschichte entdecken.",
    url: "/wissen",
  },
};

function buildKnowledgeStructuredData() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Wissen & Tipps",
    url: `${siteUrl}/wissen`,
    inLanguage: "de",
    isPartOf: {
      "@id": `${siteUrl}/#website`,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: ARTICLE_SLUGS.map((slug, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/artikel/${slug}`,
        name: ARTICLE_EMBEDS[slug].title,
      })),
    },
  };
}

export default function KnowledgePage() {
  return (
    <>
      <PublicSiteHeader sectionLinkPrefix="/" />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(77,226,198,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#07111f_42%,#0b1220_100%)] text-slate-100">
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
                Wissen &amp; Tipps
              </li>
            </ol>
          </nav>

          <section className="py-12 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4DE2C6]">
              Wissensbereich
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Wissen &amp; Tipps zum Deutschlernen
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              Orientierung zu Sprachniveaus und Prüfungen sowie Hintergründe zur Entwicklung der
              deutschen Sprache — redaktionell geprüft und miteinander verknüpft.
            </p>
          </section>

          <section aria-labelledby="knowledge-articles-heading">
            <h2 id="knowledge-articles-heading" className="sr-only">
              Alle Wissensartikel
            </h2>
            <div className="grid gap-5 lg:grid-cols-3">
              {ARTICLE_SLUGS.map((slug) => {
                const article = ARTICLE_EMBEDS[slug];

                return (
                  <article
                    key={slug}
                    className="flex min-w-0 flex-col rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.32)] backdrop-blur-xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
                      {article.category}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold leading-snug text-white">
                      {article.title}
                    </h3>
                    <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">
                      {article.description}
                    </p>
                    <Link
                      href={`/artikel/${slug}`}
                      className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 px-5 py-2.5 text-sm font-semibold text-[#B9FFF2] transition hover:bg-[#4DE2C6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9FFF2] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Artikel lesen →
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildKnowledgeStructuredData()).replace(/</g, "\\u003c"),
            }}
          />
          <PublicLegalFooter variant="dark" />
        </div>
      </main>
    </>
  );
}
