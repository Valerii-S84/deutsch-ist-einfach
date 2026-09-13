import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PublicHomeContactSection,
  PublicHomeFooter,
  PublicHomeFurtherProjectsSection,
  PublicHomeHero,
  PublicHomeKnowledgeSection,
  PublicHomeProductsSection,
  PublicHomeQuizTeaserSection,
  PublicHomeStatsSection,
} from "./public-home-sections";
import { PublicSiteHeader } from "./_components/public-site-header";
import { WISSEN_ARTICLES } from "./public-home-content";
import { buildTrackedTelegramBotUrl } from "./public-home-helpers";
import {
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_NAME,
  TELEGRAM_BOT_START_PAYLOAD,
  getTelegramBotUrl,
} from "@/lib/public-site-config";

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

describe("public home scenarios", () => {
  it("renders the hero as conversion-first surface with two CTAs", () => {
    const botUrl = getTelegramBotUrl();
    const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

    const html = renderToStaticMarkup(
      <PublicHomeHero trackedTelegramBotUrl={trackedUrl} />,
    );

    expect(html).toContain("Deutsch in 5 Fragen testen");
    expect(html).toContain('href="#quiz-teaser"');
    expect(html).toContain("Quiz-Bot auf Telegram öffnen");
    expect(html).toContain(`href="${trackedUrl}"`);
    expect(html).toContain("start=site_public_home");
    expect(html).toContain("Du bekommst sofort ein Ergebnis");
    expect(html).not.toContain("Wähle dein Lernformat.");
    expect(html).not.toMatch(/Pilotphase|Projekt im Aufbau|in Vorbereitung|unverbindlich/i);
  });

  it("adds analytics dataset metadata to conversion CTAs", () => {
    const botUrl = getTelegramBotUrl();
    const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

    const html = renderToStaticMarkup(
      <PublicHomeHero trackedTelegramBotUrl={trackedUrl} />,
    );

    expect(html).toContain("data-analytics-event=\"hero_cta_click\"");
    expect(html).toContain("data-analytics-section=\"hero\"");
    expect(html).toContain("data-analytics-cta=\"telegram_bot\"");
    expect(html).toContain("data-analytics-cta=\"quiz_teaser_anchor\"");
  });

  it("includes section-level navigation in header with in-page targets", () => {
    const html = renderToStaticMarkup(<PublicSiteHeader />);

    expect(html).toContain(PUBLIC_SITE_NAME);
    expect(html).toContain(encodeURIComponent(PUBLIC_SITE_LOGO_PATH));
    expect(html).toContain("#FFF8E7");
    expect(html).not.toContain(">Deutsch Quiz Arena<");
    expect(html).toContain("Lernangebote");
    expect(html).toContain('href="#projects"');
    expect(html).toContain('href="#knowledge"');
    expect(html).toContain('href="#unterricht"');
    expect(html).toContain('href="/contact"');
  });

  it("supports site-wide section links outside the homepage", () => {
    const html = renderToStaticMarkup(<PublicSiteHeader sectionLinkPrefix="/" />);

    expect(html).toContain('href="/projects"');
    expect(html).toContain('href="/wissen"');
    expect(html).toContain('href="/contact#lernbegleitung"');
    expect(html).toContain('href="/contact"');
  });

  it("uses the site brand in the public footer", () => {
    const html = renderToStaticMarkup(<PublicHomeFooter />);

    expect(html).toContain(`© 2026 ${PUBLIC_SITE_NAME}`);
    expect(html).not.toContain("© 2026 Deutsch Quiz Arena");
  });

  it("renders the knowledge section links for all configured article slugs", () => {
    const html = renderToStaticMarkup(<PublicHomeKnowledgeSection />);

    for (const article of WISSEN_ARTICLES) {
      const slug = article.slug;
      expect(html).toContain(`/artikel/${slug}`);
      expect(html).toContain(article.title);
    }
    expect(html).toContain('href="/wissen"');
    expect(html).toContain("Alle Artikel entdecken");
  });

  it("orders the conversion journey as hero, quiz, social proof, then one product block", () => {
    const botUrl = getTelegramBotUrl();
    const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

    const html = renderToStaticMarkup(
      <>
        <PublicHomeHero trackedTelegramBotUrl={trackedUrl} />
        <PublicHomeQuizTeaserSection trackedTelegramBotUrl={trackedUrl} />
        <PublicHomeStatsSection stats={{ users: 12, quizzes: 34, isUnavailable: false }} />
        <PublicHomeProductsSection trackedTelegramBotUrl={trackedUrl} />
      </>,
    );

    expect(html.indexOf('id="hero"')).toBeLessThan(html.indexOf('id="quiz-teaser"'));
    expect(html.indexOf('id="quiz-teaser"')).toBeLessThan(html.indexOf('id="stats"'));
    expect(html.indexOf('id="stats"')).toBeLessThan(html.indexOf('id="projects"'));
    expect(html.match(/id="projects"/g)).toHaveLength(1);
  });

  it("keeps three German-learning offers in one consistent product grid", () => {
    const trackedUrl = buildTrackedTelegramBotUrl(
      getTelegramBotUrl(),
      TELEGRAM_BOT_START_PAYLOAD,
    );
    const html = renderToStaticMarkup(
      <PublicHomeProductsSection trackedTelegramBotUrl={trackedUrl} />,
    );

    expect(html).toContain("Deutsch Quiz Arena");
    expect(html).toContain("Deutsch ist einfach!");
    expect(html).toContain("Deutsch Trainer Bot");
    expect(html).not.toContain("Worklog");
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).toContain('sizes="(min-width: 1024px) 352px');
    expect(html.match(/alt=""/g)).toHaveLength(3);
  });

  it("shows non-learning projects separately with honest link behavior", () => {
    const html = renderToStaticMarkup(<PublicHomeFurtherProjectsSection />);

    expect(html).toContain("Weitere Projekte");
    expect(html).toContain("Worklog");
    expect(html).toContain('href="/downloads/worklog/direct-hoofdrapport.apk"');
    expect(html).toContain('download="worklog.apk"');
    expect(html).toContain("Android-App herunterladen");
    expect(html).not.toContain('href="/contact"');
    expect(html).toContain("Bücher");
    expect(html).toContain('href="/books"');
    expect(html).toContain("Deutsch für Elektriker als Printausgabe und Kindle-eBook");
    expect(html).toContain("Shorts Blocker Kids");
    expect(html).toContain('href="https://www.shortsblockerkids.de/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("labels fresh and unavailable statistics without inventing a timestamp", () => {
    const freshHtml = renderToStaticMarkup(
      <PublicHomeStatsSection stats={{ users: 12, quizzes: 34, isUnavailable: false }} />,
    );
    const unavailableHtml = renderToStaticMarkup(
      <PublicHomeStatsSection stats={{ users: null, quizzes: null, isUnavailable: true }} />,
    );

    expect(freshHtml).toContain("Bei jedem Seitenaufruf neu geladen");
    expect(unavailableHtml).toContain("Datenabruf derzeit nicht verfügbar");
  });

  it("renders public German quiz teaser copy and CTA labels", () => {
    const botUrl = getTelegramBotUrl();
    const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

    const html = renderToStaticMarkup(
      <PublicHomeQuizTeaserSection trackedTelegramBotUrl={trackedUrl} />,
    );

    expect(html).toContain("Interaktiver Test");
    expect(html).toContain("Teste dein Deutsch in 5 Fragen.");
    expect(html).toContain("Heutige Runde starten");
    expect(html).toContain("A1 bis B2");
    expect(html).toContain("5 neue Fragen pro Tag");
  });

  it("provides distinct student and partner contact entry points", () => {
    const html = renderToStaticMarkup(
      <PublicHomeContactSection onOpenStudentWizard={() => undefined} onOpenPartnerWizard={() => undefined} />,
    );

    expect(html).toContain("Lernbegleitung anfragen");
    expect(html).toContain("Kooperation anfragen");
    expect(html).not.toMatch(/Pilotphase|in Vorbereitung|unverbindlich/i);
  });
});

describe("public content isolation", () => {
  it("keeps public page language as German", () => {
    const rootLayout = readFile(join(process.cwd(), "app", "layout.tsx"));
    const articlePage = readFile(join(process.cwd(), "app", "(public)", "artikel", "[slug]", "page.tsx"));

    expect(rootLayout).toContain('lang="de"');
    expect(articlePage).toContain('lang="de"');
  });

  it("does not expose admin login surface from public homepage client code", () => {
    const source = readFile(
      join(process.cwd(), "app", "(public)", "public-home-client.tsx"),
    );

    expect(source).not.toContain("PublicHomeAdminLoginModal");
    expect(source).not.toContain("/admin/login");
    expect(source).not.toContain("admin login");
  });

  it("does not render Quiz Bank secret names into public quiz teaser markup", () => {
    const botUrl = getTelegramBotUrl();
    const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

    const html = renderToStaticMarkup(
      <PublicHomeQuizTeaserSection trackedTelegramBotUrl={trackedUrl} />,
    );

    expect(html).not.toContain("QUIZ_BANK_API_BASE_URL");
    expect(html).not.toContain("QUIZ_BANK_EDGE_API_KEY");
    expect(html).not.toContain("QUIZ_BANK_CONSUMER_ID");
    expect(html).not.toContain("QUIZ_BANK_CONSUMER_API_KEY");
  });

  it("keeps Quiz Bank credentials out of browser quiz teaser code", () => {
    const widgetSource = readFile(
      join(process.cwd(), "app", "(public)", "_components", "quiz-teaser-widget.tsx"),
    );
    const apiSource = readFile(
      join(process.cwd(), "app", "(public)", "_components", "quiz-teaser-api.ts"),
    );

    expect(`${widgetSource}\n${apiSource}`).toContain("/api/quiz-teaser/next");
    expect(`${widgetSource}\n${apiSource}`).not.toContain("QUIZ_BANK_API_BASE_URL");
    expect(`${widgetSource}\n${apiSource}`).not.toContain("QUIZ_BANK_EDGE_API_KEY");
    expect(`${widgetSource}\n${apiSource}`).not.toContain("QUIZ_BANK_CONSUMER_ID");
    expect(`${widgetSource}\n${apiSource}`).not.toContain("QUIZ_BANK_CONSUMER_API_KEY");
  });

  it("adds privacy/contact legal paths and avoids placeholder local email on contact page", () => {
    const source = readFile(join(process.cwd(), "app", "(public)", "contact", "page.tsx"));
    const footerSource = readFile(
      join(process.cwd(), "app", "(public)", "_components", "public-legal-footer.tsx"),
    );

    expect(source).toContain("PublicLegalFooter");
    expect(footerSource).toContain('/privacy"');
    expect(footerSource).toContain('/impressum"');
    expect(source).not.toContain("ops@quizarena.local");
  });
});

describe("wizard dialog contract", () => {
  it("keeps Radix dialog structure and explicit close description in shared modal", () => {
    const source = readFile(
      join(process.cwd(), "app", "(public)", "_components", "contact-wizard-shared.tsx"),
    );

    expect(source).toContain("Dialog.Title");
    expect(source).toContain("Dialog.Close asChild");
    expect(source).toContain("aria-label=\"Schließen\"");
    expect(source).toContain("Dialog.Portal");
    expect(source).toContain("Dialog.Overlay");
    expect(source).toContain("Dialog.Content");
  });

  it("keeps shared wizard modal with dialog description", () => {
    const source = readFile(
      join(process.cwd(), "app", "(public)", "_components", "contact-wizard-shared.tsx"),
    );

    expect(source).toContain("Dialog.Description");
    expect(source).toContain("Dialog.Title");
    expect(source).toContain("Dialog.Close asChild");
  });

  it("adds explicit labels and aria metadata to student wizard form", () => {
    const source = readFile(
      join(process.cwd(), "app", "(public)", "_components", "contact-wizard-student.tsx"),
    );

    expect(source).toContain("STUDENT_ERROR_ID");
    expect(source).toContain('htmlFor={STUDENT_NAME_FIELD_ID}');
    expect(source).toContain('htmlFor={STUDENT_CONTACT_FIELD_ID}');
    expect(source).toContain('aria-required="true"');
    expect(source).toContain('aria-invalid={errorFieldId === STUDENT_NAME_FIELD_ID}');
    expect(source).toContain('aria-describedby={errorFieldId === STUDENT_CONTACT_FIELD_ID ? STUDENT_ERROR_ID : undefined}');
    expect(source).toContain('ValidationResult');
    expect(source).toContain('useEffect(() => {');
    expect(source).toContain("role=\"alert\"");
  });

  it("adds explicit labels and aria metadata to partner wizard form", () => {
    const source = readFile(
      join(process.cwd(), "app", "(public)", "_components", "contact-wizard-partner.tsx"),
    );

    expect(source).toContain("PARTNER_ERROR_ID");
    expect(source).toContain('htmlFor={PARTNER_NAME_FIELD_ID}');
    expect(source).toContain('htmlFor={PARTNER_CONTACT_FIELD_ID}');
    expect(source).toContain('aria-required="true"');
    expect(source).toContain('aria-invalid={errorFieldId === PARTNER_NAME_FIELD_ID}');
    expect(source).toContain('aria-describedby={errorFieldId === PARTNER_CONTACT_FIELD_ID ? PARTNER_ERROR_ID : undefined}');
    expect(source).toContain('ValidationResult');
    expect(source).toContain('useEffect(() => {');
    expect(source).toContain("role=\"alert\"");
  });
});

describe("admin login form labels and aria states", () => {
  it("adds labels and validation metadata to admin login page", () => {
    const source = readFile(
      join(process.cwd(), "app", "(admin)", "admin", "login", "page.tsx"),
    );

    expect(source).toContain("htmlFor=\"admin-email\"");
    expect(source).toContain("htmlFor=\"admin-password\"");
    expect(source).toContain('aria-invalid={form.formState.errors.email ? "true" : "false"}');
    expect(source).toContain('aria-describedby={form.formState.errors.password ? "admin-password-error" : undefined}');
    expect(source).toContain('id="admin-login-error"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("document.getElementById(\"admin-email\")?.focus();");
  });
});
