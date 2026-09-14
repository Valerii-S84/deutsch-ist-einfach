import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({
    className: "fraunces-font",
  }),
  Inter: () => ({
    className: "inter-font",
  }),
  Space_Grotesk: () => ({
    className: "space-grotesk-font",
  }),
}));

import { metadata as homeMetadata } from "@/app/(public)/page";
import * as articlePage from "@/app/(public)/artikel/[slug]/page";
import { metadata as contactMetadata } from "@/app/(public)/contact/page";
import { metadata as impressumMetadata } from "@/app/(public)/impressum/page";
import { metadata as privacyMetadata } from "@/app/(public)/privacy/page";
import { metadata as projectsMetadata } from "@/app/(public)/projects/page";
import { metadata as knowledgeMetadata } from "@/app/(public)/wissen/page";
import { metadata as rootMetadata } from "@/app/layout";
import {
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_LOGO_HEIGHT,
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_LOGO_WIDTH,
  PUBLIC_SITE_NAME,
  QUIZ_PRODUCT_NAME,
  getSiteUrl,
} from "@/lib/public-site-config";
import { buildPublicSiteStructuredData } from "@/lib/public-site-structured-data";
import { extractArticleBodyAndStyles } from "@/lib/article-content";
import { ARTICLE_EMBEDS, ARTICLE_SLUGS } from "@/lib/article-definitions";
import { ARTICLE_SERVER_RENDERED_PAYLOAD } from "@/lib/article-server-rendered-content";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

type JsonLdPayload = Record<string, unknown>;

function parseJsonLdScripts(html: string): JsonLdPayload[] {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);

  return Array.from(matches).map((match) => {
    const raw = match[1];
    return JSON.parse(raw) as JsonLdPayload;
  });
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const image = readFileSync(filePath);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  expect(image.subarray(0, pngSignature.length)).toEqual(pngSignature);

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

describe("public SEO metadata contracts", () => {
  it("defines a consistent root metadata template and Open Graph payload", () => {
    const rootOpenGraph = rootMetadata.openGraph as Record<string, unknown> | undefined;

    expect(rootMetadata).toMatchObject({
      applicationName: PUBLIC_SITE_NAME,
      title: {
        default: PUBLIC_SITE_NAME,
        template: `%s | ${PUBLIC_SITE_NAME}`,
      },
      description: PUBLIC_SITE_DESCRIPTION,
      publisher: PUBLIC_SITE_NAME,
      openGraph: {
        type: "website",
        siteName: PUBLIC_SITE_NAME,
        title: PUBLIC_SITE_NAME,
        images: [
          {
            url: PUBLIC_SITE_LOGO_PATH,
            width: PUBLIC_SITE_LOGO_WIDTH,
            height: PUBLIC_SITE_LOGO_HEIGHT,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: PUBLIC_SITE_NAME,
        images: [PUBLIC_SITE_LOGO_PATH],
      },
    });

    expect(rootMetadata.metadataBase?.href).toBe(new URL(getSiteUrl()).href);
    expect(rootMetadata.openGraph?.images).toHaveLength(1);
    expect(rootOpenGraph?.type).toBe("website");
    expect(JSON.stringify(rootMetadata.icons)).not.toContain(PUBLIC_SITE_LOGO_PATH);
  });

  it("uses small square brand assets for favicon metadata", () => {
    expect(rootMetadata.icons).toMatchObject({
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
      shortcut: "/favicon-48x48.png",
    });

    const iconSizes = [16, 32, 48, 180];
    const iconFiles = [
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon-48x48.png",
      "apple-touch-icon.png",
    ];

    iconFiles.forEach((fileName, index) => {
      const filePath = join(process.cwd(), "public", fileName);

      expect(readPngDimensions(filePath)).toEqual({
        width: iconSizes[index],
        height: iconSizes[index],
      });
      expect(statSync(filePath).size).toBeLessThan(50_000);
    });
  });

  it("publishes the site brand and logo as Organization and WebSite structured data", () => {
    const siteUrl = getSiteUrl();
    const entries = buildPublicSiteStructuredData();
    const organization = entries.find((entry) => entry["@type"] === "Organization");
    const website = entries.find((entry) => entry["@type"] === "WebSite");

    expect(organization).toMatchObject({
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
    });
    expect(website).toMatchObject({
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: PUBLIC_SITE_NAME,
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    });
  });

  it("exposes dedicated metadata for public landing routes", () => {
    expect(homeMetadata.title).toBe("Deutsch lernen mit Quiz und Artikeln");
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(homeMetadata.openGraph).toMatchObject({
      siteName: PUBLIC_SITE_NAME,
      title: `Deutsch lernen mit Quiz und Artikeln | ${PUBLIC_SITE_NAME}`,
      images: [{ url: PUBLIC_SITE_LOGO_PATH }],
    });
    expect(projectsMetadata.title).toBe("Lernangebote");
    expect(knowledgeMetadata.title).toBe("Wissen & Tipps");
    expect(knowledgeMetadata.alternates?.canonical).toBe("/wissen");
    expect(contactMetadata.title).toBe("Kontakt");
    expect(privacyMetadata.title).toBe("Datenschutzerklärung");
    expect(impressumMetadata.title).toBe("Impressum");
  });

  it("provides article-level metadata based on known slugs", async () => {
    for (const slug of ARTICLE_SLUGS) {
      const article = ARTICLE_EMBEDS[slug];
      const pageMetadata = await articlePage.generateMetadata({
        params: Promise.resolve({ slug }),
      });
      const articleOpenGraph = pageMetadata.openGraph as Record<string, unknown> | undefined;

      expect(pageMetadata.title).toBe(article.title);
      expect(pageMetadata.description).toBe(article.description);
      expect(pageMetadata.alternates?.canonical).toBe(`/artikel/${slug}`);
      expect(articleOpenGraph?.url).toBe(`/artikel/${slug}`);
      expect(articleOpenGraph?.type).toBe("article");
    }
  });

  it("renders complete structured data for all article pages", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");
    const siteUrl = getSiteUrl();

    for (const slug of ARTICLE_SLUGS) {
      const article = ARTICLE_EMBEDS[slug];
      const html = renderToStaticMarkup(
        await ArticlePage({
          params: Promise.resolve({ slug }),
        }),
      );

      const jsonLd = parseJsonLdScripts(html);

      const articleData = jsonLd.find((entry) => entry["@type"] === "Article");
      const breadcrumbData = jsonLd.find((entry) => entry["@type"] === "BreadcrumbList");

      expect(articleData).toBeDefined();
      expect(articleData?.headline).toBe(article.title);
      expect(articleData?.description).toBe(article.description);
      expect(articleData?.mainEntityOfPage).toBe(`${siteUrl}/artikel/${slug}`);
      expect(articleData?.publisher).toMatchObject({
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: PUBLIC_SITE_NAME,
        logo: {
          url: new URL(PUBLIC_SITE_LOGO_PATH, siteUrl).toString(),
        },
      });
      expect(articleData?.isPartOf).toMatchObject({
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: PUBLIC_SITE_NAME,
      });

      const breadcrumbItems = (breadcrumbData?.itemListElement ?? []) as Array<JsonLdPayload>;
      expect(breadcrumbData).toBeDefined();
      expect(breadcrumbItems).toHaveLength(3);
      expect(breadcrumbItems?.[0]).toMatchObject({
        "@type": "ListItem",
        name: "Startseite",
        position: 1,
      });
      expect(breadcrumbItems?.[1]).toMatchObject({
        "@type": "ListItem",
        name: "Wissen & Tipps",
        position: 2,
      });
      expect(breadcrumbItems?.[2]).toMatchObject({
        "@type": "ListItem",
        name: article.breadcrumbLabel,
        position: 3,
      });
    }
  });

  it("returns a stable fallback title for unknown article slugs", async () => {
    const pageMetadata = await articlePage.generateMetadata({
      params: Promise.resolve({ slug: "not-found" }),
    });

    expect(pageMetadata.title).toBe("Artikel nicht gefunden");
  });

  it("keeps Deutsch Quiz Arena scoped to the quiz product instead of the site identity", () => {
    expect(PUBLIC_SITE_NAME).toBe("Deutsch ist einfach!");
    expect(QUIZ_PRODUCT_NAME).toBe("Deutsch Quiz Arena");
    expect(rootMetadata.title).toMatchObject({
      default: PUBLIC_SITE_NAME,
      template: `%s | ${PUBLIC_SITE_NAME}`,
    });
    expect(privacyMetadata.openGraph).toMatchObject({
      title: `Datenschutzerklärung | ${PUBLIC_SITE_NAME}`,
    });
    expect(impressumMetadata.openGraph).toMatchObject({
      title: `Impressum | ${PUBLIC_SITE_NAME}`,
    });
  });

  it("keeps the public privacy copy limited to documented legal facts", () => {
    const privacyFilePath = join(process.cwd(), "app", "(public)", "privacy", "page.tsx");
    const source = readFileSync(privacyFilePath, "utf-8");

    expect(source).toContain("Hetzner Online GmbH");
    expect(source).toContain("Analytics-Ereignisse: 90 Tage.");
    expect(source).toContain("6 Monate nach der letzten Bearbeitung");
    expect(source).toContain("Hosting und technische Server-Protokolle");
    // No fixed log retention period is established by the current deployment.
    expect(source).not.toContain("Server-, Proxy- und Sicherheitsprotokolle: 14 Tage");
    expect(source).toContain("Du erreichst uns per E-Mail");
    expect(source).toContain("§ 25 Abs. 2 TDDDG");
    // The deployed copy describes automatic analytics and a retained opt-out.
    // Do not reintroduce the obsolete consent-flow wording through this test.
    expect(source).toContain("IP-Adressen dienen nur kurzzeitig der Begrenzung");

    expect(source).not.toContain("nicht betriebsbereit");
    expect(source).not.toContain("Kontaktformular");
    expect(source).not.toContain("TTDSG");

    expect(source).not.toContain("FastAPI");
    expect(source).not.toContain("PostgreSQL");
    expect(source).not.toContain("Redis");
    expect(source).not.toContain("Caddy");
    expect(source).not.toContain("contact_requests");
    expect(source).not.toContain("website_events");
    expect(source).not.toContain("Sentry");
    expect(source).not.toContain("Logtail");
    expect(source).not.toContain("Cloudflare");
    expect(source).not.toContain("Google Analytics");
    expect(source).not.toContain("Matomo");
    expect(source).not.toContain("Plausible");
  });
});

describe("public robots and sitemap contracts", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      return;
    }

    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("generates sitemap URL in robots from site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://qa.quizarena.test";

    const robotsConfig = robots();

    expect(robotsConfig.sitemap).toBe("https://qa.quizarena.test/sitemap.xml");
    expect(robotsConfig.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "*", disallow: ["/admin"] }),
      ]),
    );
  });

  it("includes all public routes and article pages in sitemap", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://qa.quizarena.test";

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    const uniqueUrls = new Set(urls);
    const expectedRoutes = [
      "https://qa.quizarena.test/",
      "https://qa.quizarena.test/wissen",
      "https://qa.quizarena.test/projects",
      "https://qa.quizarena.test/books",
      "https://qa.quizarena.test/contact",
      "https://qa.quizarena.test/privacy",
      "https://qa.quizarena.test/impressum",
      ...ARTICLE_SLUGS.map((slug) => `https://qa.quizarena.test/artikel/${slug}`),
    ];

    expect(urls).toEqual(expect.arrayContaining(expectedRoutes));
    expect(urls).not.toContain(
      "https://qa.quizarena.test/artikel/sprachniveaus-a1-c1",
    );
    expect(uniqueUrls.size).toBe(urls.length);

    for (const slug of ARTICLE_SLUGS) {
      const articleEntry = entries.find(
        (entry) => entry.url === `https://qa.quizarena.test/artikel/${slug}`,
      );
      expect(articleEntry?.lastModified).toBe(ARTICLE_EMBEDS[slug].lastModified);
      expect(articleEntry?.changeFrequency).toBeUndefined();
      expect(articleEntry?.priority).toBeUndefined();
    }

    expect(entries.find((entry) => entry.url === "https://qa.quizarena.test/")?.lastModified).toBeUndefined();
  });
});

describe("knowledge transport implementation", () => {
  const filePath = join(
    process.cwd(),
    "app",
    "(public)",
    "artikel",
    "[slug]",
    "page.tsx",
  );

  it("renders a crawlable knowledge hub for all articles", async () => {
    const { default: KnowledgePage } = await import("./wissen/page");
    const html = renderToStaticMarkup(KnowledgePage());

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).toContain('"@type":"ItemList"');

    for (const slug of ARTICLE_SLUGS) {
      expect(html).toContain(`href="/artikel/${slug}"`);
      expect(html).toContain(ARTICLE_EMBEDS[slug].title);
    }
  });

  it("does not render knowledge article through iframe srcDoc", () => {
    const source = readFileSync(filePath, "utf-8");

    expect(source).not.toContain("srcDoc=");
    expect(source).not.toContain("<iframe");
    expect(source).toContain("application/ld+json");
    expect(source).toContain("notFound()");
  });

  it("keeps required inline scripts and onclick handlers for article interactivity", () => {
    for (const slug of ARTICLE_SLUGS) {
      const articleFilePath = join(
        process.cwd(),
        "content",
        "artikel",
        ARTICLE_EMBEDS[slug].fileName,
      );
      const sourceArticle = readFileSync(articleFilePath, "utf-8");
      const extracted = extractArticleBodyAndStyles(sourceArticle, "dq-article-document");

      expect(sourceArticle).toContain("<script");
      expect(extracted.content).toContain("<script");
      expect(extracted.content).toContain("onclick=");
      expect(extracted.content).toContain("function ");
    }
  });

  it("keeps generated article payloads synchronized with the editorial sources", () => {
    for (const slug of ARTICLE_SLUGS) {
      const articleFilePath = join(
        process.cwd(),
        "content",
        "artikel",
        ARTICLE_EMBEDS[slug].fileName,
      );
      const sourceArticle = readFileSync(articleFilePath, "utf-8");

      expect(ARTICLE_SERVER_RENDERED_PAYLOAD[slug]).toEqual(
        extractArticleBodyAndStyles(sourceArticle, "dq-article-document"),
      );
    }
  });

  it("renders answer-first content and article-specific quiz attribution", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");
    const answerFirstArticles = [
      ["pruefungen-goethe-telc-testdaf", "Welche Deutschprüfung brauche ich?"],
      ["sprachniveaus-a0-c2", "Wie lange dauert es, Deutsch B2 zu erreichen?"],
    ] as const;

    for (const [slug, question] of answerFirstArticles) {
      const html = renderToStaticMarkup(
        await ArticlePage({ params: Promise.resolve({ slug }) }),
      );

      expect(html).toContain("Kurzantwort");
      expect(html).toContain(question);
      expect(html).toContain(`start=${ARTICLE_EMBEDS[slug].telegramStartPayload}`);
      expect(html).toContain("data-article-quiz-cta");
      expect(html).not.toContain("__ARTICLE_QUIZ_BOT_URL__");
    }
  });

  it("scopes only standalone body selectors without corrupting component class names", () => {
    const fixture = `
      <style>
        body, body.article-theme { color: white; }
        .card-body, .era-body, .prov-body, .tr-body { max-height: 0; }
        @media (max-width: 640px) { body { padding: 0; } }
      </style>
      <body><div class="card-body">Test</div></body>
    `;
    const extracted = extractArticleBodyAndStyles(fixture, "dq-article-document");

    expect(extracted.styles).toContain(
      ".dq-article-document, .dq-article-document.article-theme",
    );
    expect(extracted.styles).toContain(
      ".card-body, .era-body, .prov-body, .tr-body",
    );
    expect(extracted.styles).toContain("{ .dq-article-document { padding: 0; }");
    expect(extracted.styles).not.toMatch(/\.(?:card|era|prov|tr)-\.dq-article-document/);

    for (const payload of Object.values(ARTICLE_SERVER_RENDERED_PAYLOAD)) {
      expect(payload.styles).not.toMatch(/\.(?:card|era|prov|tr)-\.dq-article-document/);
    }
  });

  it("preserves the reviewed content corrections", () => {
    const levelsSource = readFileSync(
      join(process.cwd(), "content", "artikel", "sprachniveaus-a0-c2.html"),
      "utf-8",
    );
    const examsSource = readFileSync(
      join(process.cwd(), "content", "artikel", "pruefungen-goethe-telc-testdaf.html"),
      "utf-8",
    );
    const historySource = readFileSync(
      join(process.cwd(), "content", "artikel", "deutsche-sprache-geschichte.html"),
      "utf-8",
    );

    expect(levelsSource).toContain("telc Deutsch C2");
    expect(levelsSource).toContain("A0</strong> ist keine offizielle Bezeichnung");
    expect(levelsSource).not.toContain("Richtwerte des Europarates");
    expect(levelsSource).not.toContain("Mindestniveau für die Zulassung zu den meisten Universitäten");

    expect(examsSource).toContain(
      "Modular sind die Goethe-Zertifikate B1, B2, C1 und C2",
    );
    expect(examsSource).toContain("unterschiedliche Aufgabenportfolios");
    expect(examsSource).not.toContain("Jedes Niveau besteht aus vier klar getrennten Modulen");
    expect(examsSource).not.toContain("A1 – C1 · Integrationsrelevant");

    expect(historySource).toContain("1901/1902");
    expect(historySource).toContain("Eine einzelne, abschließend belegte Ursache gibt es nicht");
    expect(historySource).toContain("durch die vergleichende Methode");
    expect(historySource).toContain("der Stauferzeit");
    expect(historySource).toContain("Klimawandel (Neuprägung)");
    expect(historySource).not.toContain("durch das Vergleichende Methode");
    expect(historySource).not.toContain("Stauferzeitzeitalters");
    expect(historySource).not.toContain("Neuprägun)");

    for (const source of [levelsSource, examsSource, historySource]) {
      expect(source).not.toMatch(/„[^<]*"/);
    }
  });

  it("defines an exact 301 redirect from the retired levels URL", () => {
    const configSource = readFileSync(join(process.cwd(), "next.config.mjs"), "utf-8");

    expect(configSource).toContain('source: "/artikel/sprachniveaus-a1-c1"');
    expect(configSource).toContain('destination: "/artikel/sprachniveaus-a0-c2"');
    expect(configSource).toContain("statusCode: 301");
  });

  it("keeps raw article source files out of public/ while preserving content sources", () => {
    for (const slug of ARTICLE_SLUGS) {
      const fileName = ARTICLE_EMBEDS[slug].fileName;
      const publicFilePath = join(process.cwd(), "public", "artikel", fileName);
      const contentFilePath = join(process.cwd(), "content", "artikel", fileName);

      expect(existsSync(publicFilePath)).toBe(false);
      expect(existsSync(contentFilePath)).toBe(true);
    }
  });

  it("throws notFound for missing article content during render", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");

    await expect(
      ArticlePage({
        params: Promise.resolve({ slug: "missing-article" }),
      }),
    ).rejects.toBeDefined();
  });

  it("renders Article and BreadcrumbList structured data on article pages", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");

    for (const slug of ARTICLE_SLUGS) {
      const article = ARTICLE_EMBEDS[slug];
      const html = renderToStaticMarkup(
        await ArticlePage({
          params: Promise.resolve({ slug }),
        }),
      );

      expect(html).toContain('"@type":"Article"');
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(html).toContain(`"position":3`);
      expect(html).toContain(`"name":"${article.breadcrumbLabel}"`);
      expect(html).toContain(`"name":"Wissen & Tipps"`);
    }
  });

  it("renders visible breadcrumbs and a two-way related-article network", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");

    for (const slug of ARTICLE_SLUGS) {
      const article = ARTICLE_EMBEDS[slug];
      const html = renderToStaticMarkup(
        await ArticlePage({
          params: Promise.resolve({ slug }),
        }),
      );

      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('href="/wissen"');
      expect(html).toContain("Wissen &amp; Tipps");
      expect(html).toContain('aria-current="page"');
      expect(html).toContain(`>${article.breadcrumbLabel}</li></ol>`);
      expect(html).toContain("Das könnte dich auch interessieren");
      expect(article.relatedSlugs).toHaveLength(2);
      expect(article.relatedSlugs).not.toContain(slug);

      for (const relatedSlug of article.relatedSlugs) {
        expect(html).toContain(`href="/artikel/${relatedSlug}"`);
        expect(html).toContain(ARTICLE_EMBEDS[relatedSlug].title);
      }
    }

    expect(ARTICLE_EMBEDS["sprachniveaus-a0-c2"].relatedSlugs[0]).toBe(
      "pruefungen-goethe-telc-testdaf",
    );
    expect(ARTICLE_EMBEDS["pruefungen-goethe-telc-testdaf"].relatedSlugs[0]).toBe(
      "sprachniveaus-a0-c2",
    );
  });

  it("renders article pages inside the dark premium reader shell", async () => {
    const { default: ArticlePage } = await import("./artikel/[slug]/page");

    for (const slug of ["sprachniveaus-a0-c2", "deutsche-sprache-geschichte"] as const) {
      const html = renderToStaticMarkup(
        await ArticlePage({
          params: Promise.resolve({ slug }),
        }),
      );

      expect(html).toContain("Deutsch ist einfach!");
      expect(html).toContain('href="/projects"');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain("bg-slate-950/40");
      expect(html).toContain("border-white/10");
      expect(html).toContain("text-slate-100");
      expect(html).toContain("dq-article-document");

      expect(html).not.toContain("bg-white/90");
      expect(html).not.toContain("bg-white/82");
      expect(html).not.toContain("border-slate-200");
      expect(html).not.toContain("--bg: #cedde8");
      expect(html).not.toContain("--surface: #f4f7fa");
    }
  });

  it("keeps the article source files on the dark readable palette", () => {
    const articleFiles = [
      "sprachniveaus-a0-c2.html",
      "deutsche-sprache-geschichte.html",
    ] as const;

    for (const articleFile of articleFiles) {
      const source = readFileSync(
        join(process.cwd(), "content", "artikel", articleFile),
        "utf-8",
      );

      expect(source).toContain("font-weight: 400;");
      expect(source).toContain("--surface: rgba(15, 23, 42, 0.72);");
      expect(source).toContain("--border: rgba(148, 163, 184, 0.18);");
      expect(source).toContain("--text: #eaf2ff;");
      expect(source).toContain("--muted: #a9b7c9;");

      expect(source).not.toContain("font-weight: 300;");
      expect(source).not.toContain("--bg: #cedde8");
      expect(source).not.toContain("--surface: #f4f7fa");
      expect(source).not.toContain("rgba(255,255,255,0.97)");
    }

    const cefrSource = readFileSync(
      join(process.cwd(), "content", "artikel", "sprachniveaus-a0-c2.html"),
      "utf-8",
    );
    const historySource = readFileSync(
      join(process.cwd(), "content", "artikel", "deutsche-sprache-geschichte.html"),
      "utf-8",
    );

    expect(cefrSource).toContain("--bg: #0b1220;");
    expect(cefrSource).toContain("--accent: #facc15;");
    expect(historySource).toContain("--bg: #07111f;");
    expect(historySource).toContain("--accent: #f3cf78;");
  });
});
