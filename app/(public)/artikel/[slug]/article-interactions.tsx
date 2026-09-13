"use client";

import { useEffect } from "react";

import { usePublicAnalytics } from "@/app/analytics-provider";

declare global {
  interface Window {
    toggleCard?: (id: string) => void;
    toggleEra?: (id: string) => void;
  }
}

type ArticleInteractionsProps = {
  articleSlug?: string;
  defaultOpenSectionId?: string;
};

const ARTICLE_DISCLOSURE_SELECTOR = ".level-card, .prov-card, .era-card";
const ARTICLE_DISCLOSURE_HEADER_SELECTOR = ".card-header, .prov-header, .era-card-header";
const ARTICLE_DISCLOSURE_BODY_SELECTOR = ".card-body, .prov-body, .era-body";
const ARTICLE_DISCLOSURE_TOGGLE_SELECTOR = ".card-toggle, .prov-toggle, .era-toggle";
const ARTICLE_DISCLOSURE_TITLE_SELECTOR =
  '[data-article-toc-heading="true"], .card-title, .prov-title, .era-title';

function syncArticleDisclosureState(section: HTMLElement) {
  const toggle = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_TOGGLE_SELECTOR);
  const body = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_BODY_SELECTOR);
  const title = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_TITLE_SELECTOR);
  const isOpen = section.classList.contains("open");
  const titleText = title?.textContent?.trim() || "Abschnitt";

  toggle?.setAttribute("aria-expanded", String(isOpen));
  if (toggle && title?.id) {
    toggle.setAttribute("aria-labelledby", title.id);
    toggle.removeAttribute("aria-label");
  } else {
    toggle?.removeAttribute("aria-labelledby");
    toggle?.setAttribute(
      "aria-label",
      `${titleText} ${isOpen ? "einklappen" : "ausklappen"}`,
    );
  }

  if (body) {
    body.setAttribute("aria-hidden", String(!isOpen));
    body.toggleAttribute("inert", !isOpen);
  }
}

function setArticleSectionOpen(section: HTMLElement, open: boolean) {
  section.classList.toggle("open", open);
  syncArticleDisclosureState(section);
}

function toggleArticleSection(id: string) {
  const section = document.getElementById(id);

  if (section) {
    setArticleSectionOpen(section, !section.classList.contains("open"));
  }
}

function decodeArticleHash(hash: string): string | null {
  const encodedId = hash.startsWith("#") ? hash.slice(1) : hash;

  if (!encodedId) {
    return null;
  }

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return null;
  }
}

export function ArticleInteractions({ articleSlug, defaultOpenSectionId }: ArticleInteractionsProps) {
  const { trackEvent } = usePublicAnalytics();

  useEffect(() => {
    const previousToggleCard = window.toggleCard;
    const previousToggleEra = window.toggleEra;
    const quizCtas = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("[data-article-quiz-cta]"),
    );
    const tocLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("[data-article-toc-link]"),
    );
    const disclosureCleanups: Array<() => void> = [];

    const trackQuizCta = () => {
      trackEvent("hero_cta_click", {
        article_slug: articleSlug,
        section: "article_kurzantwort",
        cta: "telegram_bot",
        destination: "telegram",
      });
    };

    window.toggleCard = toggleArticleSection;
    window.toggleEra = toggleArticleSection;

    const disclosureSections = Array.from(
      document.querySelectorAll<HTMLElement>(ARTICLE_DISCLOSURE_SELECTOR),
    );

    disclosureSections.forEach((section) => {
      const header = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_HEADER_SELECTOR);
      const toggle = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_TOGGLE_SELECTOR);
      const body = section.querySelector<HTMLElement>(ARTICLE_DISCLOSURE_BODY_SELECTOR);

      if (!header || !toggle) {
        return;
      }

      toggle.setAttribute("role", "button");
      toggle.tabIndex = 0;

      if (body && section.id) {
        body.id ||= `${section.id}-content`;
        toggle.setAttribute("aria-controls", body.id);
      }

      syncArticleDisclosureState(section);

      const toggleOnKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (section.id) {
          toggleArticleSection(section.id);
        }
      };

      toggle.addEventListener("keydown", toggleOnKeyDown);
      disclosureCleanups.push(() => {
        toggle.removeEventListener("keydown", toggleOnKeyDown);
      });
    });

    if (defaultOpenSectionId) {
      const defaultSection = document.getElementById(defaultOpenSectionId);
      if (defaultSection) {
        setArticleSectionOpen(defaultSection, true);
      }
    }

    const revealArticleAnchor = (id: string) => {
      const target = document.getElementById(id);
      const section = target?.closest<HTMLElement>(ARTICLE_DISCLOSURE_SELECTOR);

      if (section) {
        setArticleSectionOpen(section, true);
      }
    };

    const revealLocationHash = () => {
      const id = decodeArticleHash(window.location.hash);
      if (id) {
        revealArticleAnchor(id);
      }
    };

    const revealTocTarget = (event: Event) => {
      const link = event.currentTarget as HTMLAnchorElement;
      const id = decodeArticleHash(new URL(link.href, window.location.href).hash);
      if (id) {
        revealArticleAnchor(id);
      }
    };

    tocLinks.forEach((link) => link.addEventListener("click", revealTocTarget));
    window.addEventListener("hashchange", revealLocationHash);
    revealLocationHash();

    quizCtas.forEach((cta) => {
      cta.dataset.analyticsId = "telegram_bot";
      cta.dataset.analyticsPlacement = "article_kurzantwort";
      cta.dataset.analyticsExplicit = "true";
      cta.addEventListener("click", trackQuizCta);
    });

    return () => {
      quizCtas.forEach((cta) => cta.removeEventListener("click", trackQuizCta));
      tocLinks.forEach((link) => link.removeEventListener("click", revealTocTarget));
      window.removeEventListener("hashchange", revealLocationHash);
      disclosureCleanups.forEach((cleanup) => cleanup());

      if (previousToggleCard) {
        window.toggleCard = previousToggleCard;
      } else {
        delete window.toggleCard;
      }

      if (previousToggleEra) {
        window.toggleEra = previousToggleEra;
      } else {
        delete window.toggleEra;
      }
    };
  }, [articleSlug, defaultOpenSectionId, trackEvent]);

  return null;
}
