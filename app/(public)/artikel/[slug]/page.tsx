import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  prepareArticleContentForNavigation,
  type ArticleTableOfContentsItem,
} from "@/lib/article-content";
import { ARTICLE_EMBEDS } from "@/lib/article-definitions";
import { ARTICLE_SERVER_RENDERED_PAYLOAD } from "@/lib/article-server-rendered-content";
import {
  PUBLIC_SITE_LOGO_HEIGHT,
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_LOGO_WIDTH,
  PUBLIC_SITE_NAME,
  getSiteUrl,
  getTelegramBotUrl,
} from "@/lib/public-site-config";
import { buildTrackedTelegramBotUrl } from "../../public-home-helpers";
import { ArticleInteractions } from "./article-interactions";
import { PublicLegalFooter } from "../../_components/public-legal-footer";
import { PublicSiteHeader } from "../../_components/public-site-header";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const ARTICLE_DOCUMENT_CLASS = "dq-article-document";
const ARTICLE_QUIZ_BOT_URL_TOKEN = "__ARTICLE_QUIZ_BOT_URL__";
const ARTICLE_DEFAULT_OPEN_SECTIONS: Record<string, string> = {
  "deutsche-sprache-geschichte": "era-indg",
  "pruefungen-goethe-telc-testdaf": "prov-goethe",
  "sprachniveaus-a0-c2": "lv-a1",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ARTICLE_EMBEDS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLE_EMBEDS[slug];

  if (!article) {
    return {
      title: "Artikel nicht gefunden",
    };
  }

  const canonical = `/artikel/${slug}`;

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: article.title,
      description: article.description,
      images: [
        {
          url: PUBLIC_SITE_LOGO_PATH,
          width: PUBLIC_SITE_LOGO_WIDTH,
          height: PUBLIC_SITE_LOGO_HEIGHT,
          alt: article.title,
        },
      ],
    },
  };
}

function embeddedArticleTheme(): string {
  return `
.${ARTICLE_DOCUMENT_CLASS} {
  --bg: #0b1220;
  --surface: rgba(15, 23, 42, 0.72);
  --border: rgba(148, 163, 184, 0.18);
  --text: #eaf2ff;
  --muted: #a9b7c9;
  --accent: #facc15;
  --a0-bg: rgba(155,155,155,0.14);
  --a1-bg: rgba(110,198,224,0.14);
  --a2-bg: rgba(77,184,168,0.14);
  --b1-bg: rgba(126,200,110,0.14);
  --b2-bg: rgba(200,184,78,0.14);
  --c1-bg: rgba(224,120,72,0.14);
  --c2-bg: rgba(208,72,112,0.14);
  background:
    radial-gradient(circle at top, rgba(250, 204, 21, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(2, 8, 23, 0.16), rgba(2, 8, 23, 0.02)),
    linear-gradient(180deg, #07111f 0%, #0b1220 100%);
  color: var(--text);
  font-weight: 400;
  line-height: 1.78;
}
.${ARTICLE_DOCUMENT_CLASS} * {
  box-sizing: border-box;
}
.${ARTICLE_DOCUMENT_CLASS} p,
.${ARTICLE_DOCUMENT_CLASS} li,
.${ARTICLE_DOCUMENT_CLASS} td,
.${ARTICLE_DOCUMENT_CLASS} dd {
  color: var(--text);
  font-weight: 400;
}
.${ARTICLE_DOCUMENT_CLASS} .container {
  max-width: min(100%, 58rem);
}
.${ARTICLE_DOCUMENT_CLASS} [data-article-toc-heading="true"] {
  scroll-margin-top: 5.5rem;
}
@media (min-width: 640px) {
  .${ARTICLE_DOCUMENT_CLASS} [data-article-toc-heading="true"] {
    scroll-margin-top: 5.5rem;
  }
}
@media (min-width: 1024px) {
  .${ARTICLE_DOCUMENT_CLASS} [data-article-toc-heading="true"] {
    scroll-margin-top: 7rem;
  }
}
.${ARTICLE_DOCUMENT_CLASS} .card-block,
.${ARTICLE_DOCUMENT_CLASS} .tip-card,
.${ARTICLE_DOCUMENT_CLASS} .ag-cell,
.${ARTICLE_DOCUMENT_CLASS} .cefr-group,
.${ARTICLE_DOCUMENT_CLASS} .notice,
.${ARTICLE_DOCUMENT_CLASS} .time-badge,
.${ARTICLE_DOCUMENT_CLASS} .exams-table th,
.${ARTICLE_DOCUMENT_CLASS} .era-block,
.${ARTICLE_DOCUMENT_CLASS} .fg-cell,
.${ARTICLE_DOCUMENT_CLASS} .keyfact-card,
.${ARTICLE_DOCUMENT_CLASS} .laut-cell {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.16);
}
.${ARTICLE_DOCUMENT_CLASS} .card-description,
.${ARTICLE_DOCUMENT_CLASS} .tip-desc,
.${ARTICLE_DOCUMENT_CLASS} .ag-desc,
.${ARTICLE_DOCUMENT_CLASS} .cefr-group-sub,
.${ARTICLE_DOCUMENT_CLASS} .card-subtitle {
  color: var(--muted);
}
.${ARTICLE_DOCUMENT_CLASS} .exams-table td,
.${ARTICLE_DOCUMENT_CLASS} .compare-table td,
.${ARTICLE_DOCUMENT_CLASS} .compare-table th,
.${ARTICLE_DOCUMENT_CLASS} .example-item .translation,
.${ARTICLE_DOCUMENT_CLASS} .text-example .translation,
.${ARTICLE_DOCUMENT_CLASS} .fg-langs,
.${ARTICLE_DOCUMENT_CLASS} .laut-ex {
  color: var(--muted);
}
.${ARTICLE_DOCUMENT_CLASS} .exams-table tr:hover td {
  background: rgba(255, 255, 255, 0.04);
}
.${ARTICLE_DOCUMENT_CLASS} .grammar-tag,
.${ARTICLE_DOCUMENT_CLASS} .feature-tag,
.${ARTICLE_DOCUMENT_CLASS} .text-example,
.${ARTICLE_DOCUMENT_CLASS} .example-item,
.${ARTICLE_DOCUMENT_CLASS} .fact-box,
.${ARTICLE_DOCUMENT_CLASS} .era-description,
.${ARTICLE_DOCUMENT_CLASS} .card-description {
  background: rgba(8, 15, 31, 0.7);
  border-color: var(--border);
}
.${ARTICLE_DOCUMENT_CLASS} .hero-sub,
.${ARTICLE_DOCUMENT_CLASS} .section-header h2,
.${ARTICLE_DOCUMENT_CLASS} .group-label,
.${ARTICLE_DOCUMENT_CLASS} .timeline-labels,
.${ARTICLE_DOCUMENT_CLASS} .progress-labels,
.${ARTICLE_DOCUMENT_CLASS} footer,
.${ARTICLE_DOCUMENT_CLASS} footer p {
  color: var(--muted);
}
`;
}

function embeddedArticleResponsiveOverrides(): string {
  return `
.${ARTICLE_DOCUMENT_CLASS} {
  max-width: 100%;
  overflow-wrap: anywhere;
}
.${ARTICLE_DOCUMENT_CLASS} .container {
  width: 100%;
  max-width: min(100%, 58rem);
  min-width: 0;
}
.${ARTICLE_DOCUMENT_CLASS} .exams-table,
.${ARTICLE_DOCUMENT_CLASS} .level-table,
.${ARTICLE_DOCUMENT_CLASS} .big-table,
.${ARTICLE_DOCUMENT_CLASS} .compare-table {
  max-width: 100%;
}
.${ARTICLE_DOCUMENT_CLASS} .exams-table th,
.${ARTICLE_DOCUMENT_CLASS} .exams-table td,
.${ARTICLE_DOCUMENT_CLASS} .level-table th,
.${ARTICLE_DOCUMENT_CLASS} .level-table td,
.${ARTICLE_DOCUMENT_CLASS} .big-table th,
.${ARTICLE_DOCUMENT_CLASS} .big-table td,
.${ARTICLE_DOCUMENT_CLASS} .compare-table th,
.${ARTICLE_DOCUMENT_CLASS} .compare-table td {
  min-width: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 640px) {
  .${ARTICLE_DOCUMENT_CLASS} .exams-table,
  .${ARTICLE_DOCUMENT_CLASS} .level-table,
  .${ARTICLE_DOCUMENT_CLASS} .big-table,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0;
    overflow: visible;
    background: transparent;
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table thead,
  .${ARTICLE_DOCUMENT_CLASS} .level-table thead,
  .${ARTICLE_DOCUMENT_CLASS} .big-table thead,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table thead {
    display: none;
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table tbody,
  .${ARTICLE_DOCUMENT_CLASS} .level-table tbody,
  .${ARTICLE_DOCUMENT_CLASS} .big-table tbody,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table tbody {
    display: grid;
    gap: 14px;
    width: 100%;
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table tr,
  .${ARTICLE_DOCUMENT_CLASS} .level-table tr,
  .${ARTICLE_DOCUMENT_CLASS} .big-table tr,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table tr {
    display: grid;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: rgba(8, 15, 31, 0.72);
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.16);
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td,
  .${ARTICLE_DOCUMENT_CLASS} .level-table td,
  .${ARTICLE_DOCUMENT_CLASS} .big-table td,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td {
    display: grid;
    grid-template-columns: minmax(6.75rem, 38%) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    width: 100%;
    min-width: 0;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    background: rgba(8, 15, 31, 0.72);
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:last-child,
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:last-child,
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:last-child,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:last-child {
    border-bottom: 0;
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td::before,
  .${ARTICLE_DOCUMENT_CLASS} .level-table td::before,
  .${ARTICLE_DOCUMENT_CLASS} .big-table td::before,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td::before {
    content: "";
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:nth-child(1)::before {
    content: "Niveau";
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:nth-child(2)::before {
    content: "Goethe";
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:nth-child(3)::before {
    content: "ÖSD";
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:nth-child(4)::before {
    content: "telc";
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td:nth-child(5)::before {
    content: "Wozu";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(1)::before {
    content: "Niveau";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(2)::before {
    content: "Hören";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(3)::before {
    content: "Lesen";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(4)::before {
    content: "Schreiben";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(5)::before {
    content: "Sprechen";
  }
  .${ARTICLE_DOCUMENT_CLASS} .level-table td:nth-child(6)::before {
    content: "Gesamt";
  }
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:nth-child(1)::before {
    content: "Prüfung";
  }
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:nth-child(2)::before {
    content: "Niveaus";
  }
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:nth-child(3)::before {
    content: "Dauer";
  }
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:nth-child(4)::before {
    content: "Besonderheit";
  }
  .${ARTICLE_DOCUMENT_CLASS} .big-table td:nth-child(5)::before {
    content: "Anerkannt";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(1)::before {
    content: "Sprachstufe";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(2)::before {
    content: "machen";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(3)::before {
    content: "ich";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(4)::before {
    content: "Tag";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(5)::before {
    content: "gut";
  }
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td:nth-child(6)::before {
    content: "Haus";
  }
}
@media (max-width: 430px) {
  .${ARTICLE_DOCUMENT_CLASS} .hero {
    padding-inline: 16px;
  }
  .${ARTICLE_DOCUMENT_CLASS} .container {
    padding-inline: 16px;
  }
  .${ARTICLE_DOCUMENT_CLASS} .exams-table td,
  .${ARTICLE_DOCUMENT_CLASS} .level-table td,
  .${ARTICLE_DOCUMENT_CLASS} .big-table td,
  .${ARTICLE_DOCUMENT_CLASS} .compare-table td {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .${ARTICLE_DOCUMENT_CLASS} .section-header {
    min-width: 0;
    align-items: flex-start;
    gap: 10px;
  }
  .${ARTICLE_DOCUMENT_CLASS} .section-header h2 {
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .${ARTICLE_DOCUMENT_CLASS} .section-header::after {
    flex: 0 1 40px;
    margin-top: 0.75rem;
  }
}
`;
}

function buildArticleStructuredData(slug: string, title: string, description: string, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: `${siteUrl}/artikel/${slug}`,
    inLanguage: "de",
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: PUBLIC_SITE_NAME,
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: new URL(PUBLIC_SITE_LOGO_PATH, siteUrl).toString(),
        width: PUBLIC_SITE_LOGO_WIDTH,
        height: PUBLIC_SITE_LOGO_HEIGHT,
      },
    },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: PUBLIC_SITE_NAME,
      url: siteUrl,
    },
  };
}

function buildArticleBreadcrumbStructuredData(
  slug: string,
  breadcrumbLabel: string,
  siteUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Startseite",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Wissen & Tipps",
        item: `${siteUrl}/wissen`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: breadcrumbLabel,
        item: `${siteUrl}/artikel/${slug}`,
      },
    ],
  };
}

function ArticleBreadcrumbs({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-400">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link
            href="/"
            className="rounded-sm transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Startseite
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-600">
          ›
        </li>
        <li>
          <Link
            href="/wissen"
            className="rounded-sm transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Wissen &amp; Tipps
          </Link>
        </li>
        <li aria-hidden="true" className="text-slate-600">
          ›
        </li>
        <li aria-current="page" className="min-w-0 font-medium text-slate-200">
          {label}
        </li>
      </ol>
    </nav>
  );
}

function RelatedArticles({ currentSlug }: { currentSlug: string }) {
  const currentArticle = ARTICLE_EMBEDS[currentSlug];
  const relatedArticles = currentArticle.relatedSlugs.flatMap((relatedSlug) => {
    const relatedArticle = ARTICLE_EMBEDS[relatedSlug];

    return relatedArticle ? [{ slug: relatedSlug, ...relatedArticle }] : [];
  });

  return (
    <section
      aria-labelledby="related-articles-heading"
      className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.3)] sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
        Weiterlernen
      </p>
      <h2
        id="related-articles-heading"
        className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
      >
        Das könnte dich auch interessieren
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {relatedArticles.map((relatedArticle) => (
          <Link
            key={relatedArticle.slug}
            href={`/artikel/${relatedArticle.slug}`}
            className="group flex min-w-0 flex-col rounded-2xl border border-white/10 bg-slate-950/45 p-5 transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-slate-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
              {relatedArticle.category}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-white transition group-hover:text-amber-100">
              {relatedArticle.title}
            </h3>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">
              {relatedArticle.description}
            </p>
            <span className="mt-4 text-sm font-semibold text-[#4DE2C6]">Artikel lesen →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

type TableOfContentsSection = {
  heading: ArticleTableOfContentsItem;
  children: ArticleTableOfContentsItem[];
};

function groupTableOfContents(
  items: ArticleTableOfContentsItem[],
): TableOfContentsSection[] {
  const sections: TableOfContentsSection[] = [];

  for (const item of items) {
    if (item.level === 2 || sections.length === 0) {
      sections.push({ heading: item, children: [] });
      continue;
    }

    sections[sections.length - 1].children.push(item);
  }

  return sections;
}

function TableOfContentsLinks({ items }: { items: ArticleTableOfContentsItem[] }) {
  const sections = groupTableOfContents(items);
  const linkClassName =
    "block rounded-md py-1.5 leading-5 text-slate-300 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  return (
    <ol className="mt-3 space-y-2 text-sm">
      {sections.map((section) => (
        <li key={section.heading.id}>
          <a
            href={`#${section.heading.id}`}
            data-article-toc-link
            className={`${linkClassName} font-medium`}
          >
            {section.heading.label}
          </a>
          {section.children.length > 0 ? (
            <ol className="ml-2 mt-1 space-y-1 border-l border-white/10 pl-3">
              {section.children.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    data-article-toc-link
                    className={linkClassName}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ArticleTableOfContents({
  items,
  slug,
}: {
  items: ArticleTableOfContentsItem[];
  slug: string;
}) {
  if (items.length === 0) {
    return null;
  }

  const desktopHeadingId = `article-toc-${slug}`;

  return (
    <aside
      aria-label="Artikelnavigation"
      className="mb-5 lg:order-2 lg:sticky lg:top-24 lg:mb-0"
    >
      <details className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_50px_rgba(2,6,23,0.28)] lg:hidden">
        <summary className="cursor-pointer rounded-md font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          Auf dieser Seite
        </summary>
        <nav aria-label="Inhaltsverzeichnis">
          <TableOfContentsLinks items={items} />
        </nav>
      </details>

      <nav
        aria-labelledby={desktopHeadingId}
        className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_50px_rgba(2,6,23,0.28)] lg:block"
      >
        <h2
          id={desktopHeadingId}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300"
        >
          Auf dieser Seite
        </h2>
        <TableOfContentsLinks items={items} />
      </nav>
    </aside>
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeArticleHtml(html: string, quizBotUrl: string): string {
  return html
    .replaceAll(ARTICLE_QUIZ_BOT_URL_TOKEN, escapeHtmlAttribute(quizBotUrl))
    .replace(/rel="noreferrer"/g, 'rel="noopener noreferrer"')
    .replace(/(<a\b[^>]*target="_blank")(?![^>]*\brel=)/g, '$1 rel="noopener noreferrer"');
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = ARTICLE_EMBEDS[slug];
  const articlePayload = ARTICLE_SERVER_RENDERED_PAYLOAD[slug];

  if (!article) {
    notFound();
  }

  if (!articlePayload) {
    notFound();
  }

  const trackedQuizBotUrl = buildTrackedTelegramBotUrl(
    getTelegramBotUrl(),
    article.telegramStartPayload,
  );
  const navigableArticle = prepareArticleContentForNavigation(
    normalizeArticleHtml(articlePayload.content, trackedQuizBotUrl),
  );
  const articleStyles = `${embeddedArticleTheme()}\n${articlePayload.styles}\n${embeddedArticleResponsiveOverrides()}`;

  return (
    <>
      <PublicSiteHeader sectionLinkPrefix="/" trackedTelegramBotUrl={trackedQuizBotUrl} />
      <main
        lang="de"
        className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.12),transparent_26%),linear-gradient(180deg,#020617_0%,#07111f_42%,#0b1220_100%)] text-slate-100"
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <ArticleBreadcrumbs label={article.breadcrumbLabel} />
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6">
            <ArticleTableOfContents items={navigableArticle.tableOfContents} slug={slug} />
            <article className="min-w-0 rounded-[28px] border border-white/10 bg-slate-950/40 shadow-[0_28px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:order-1">
              <style
                dangerouslySetInnerHTML={{
                  __html: articleStyles,
                }}
              />
              <div
                className={`${ARTICLE_DOCUMENT_CLASS} min-w-0 rounded-[28px]`}
                dangerouslySetInnerHTML={{
                  __html: navigableArticle.content,
                }}
              />
              <ArticleInteractions
                articleSlug={slug}
                defaultOpenSectionId={ARTICLE_DEFAULT_OPEN_SECTIONS[slug]}
              />
            </article>
          </div>
          <RelatedArticles currentSlug={slug} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildArticleStructuredData(slug, article.title, article.description, getSiteUrl()),
              ),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildArticleBreadcrumbStructuredData(
                  slug,
                  article.breadcrumbLabel,
                  getSiteUrl(),
                ),
              ),
            }}
          />
          <PublicLegalFooter variant="dark" />
        </div>
      </main>
    </>
  );
}
