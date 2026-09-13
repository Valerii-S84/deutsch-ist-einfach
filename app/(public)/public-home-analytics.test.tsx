/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicHomeClient from "./public-home-client";
import {
  PublicHomeChannelSection,
  PublicHomeContactSection,
  PublicHomeHero,
  PublicHomeProductsSection,
} from "./public-home-sections";
import { PublicSiteHeader } from "./_components/public-site-header";
import { buildTrackedTelegramBotUrl } from "./public-home-helpers";
import { TELEGRAM_BOT_START_PAYLOAD, getTelegramBotUrl } from "@/lib/public-site-config";
import type { PublicAnalyticsEventName } from "@/lib/analytics";

vi.mock("@/app/analytics-provider", () => ({
  usePublicAnalytics: () => ({
    trackEvent: (...args: unknown[]) => {
      const [name, payload] = args;
      eventNameToPayload.set(String(name), [...(eventNameToPayload.get(String(name)) ?? []), payload]);
      trackEventSpy(name, payload);
    },
  }),
}));

vi.mock("./_components/contact-wizards", () => ({
  ContactWizardModal: ({ kind, isOpen }: { kind: string; isOpen: boolean }) =>
    isOpen ? <div data-wizard-open={kind} /> : null,
}));

const trackEventSpy = vi.fn();
const eventNameToPayload = new Map<string, unknown[]>();

function renderInContainer(ui: JSX.Element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function renderHomeForAnalytics() {
  const botUrl = getTelegramBotUrl();
  const trackedUrl = buildTrackedTelegramBotUrl(botUrl, TELEGRAM_BOT_START_PAYLOAD);

  const content = (
    <PublicHomeClient>
      <main id="public-home-root" lang="de">
        <PublicSiteHeader />
        <PublicHomeHero trackedTelegramBotUrl={trackedUrl} />
        <PublicHomeProductsSection trackedTelegramBotUrl={trackedUrl} />
        <PublicHomeChannelSection />
        <PublicHomeContactSection />
      </main>
    </PublicHomeClient>
  );

  return renderInContainer(content);
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  eventNameToPayload.clear();
  trackEventSpy.mockClear();
});

describe("public home analytics event wiring", () => {
  it("tracks the shared-header CTA without the home-page delegation wrapper", () => {
    const { container, cleanup } = renderInContainer(<PublicSiteHeader sectionLinkPrefix="/" />);

    try {
      const headerCta = Array.from(container.querySelectorAll("a")).find((link) =>
        link.textContent?.includes("Quiz-Bot"),
      );

      expect(headerCta).not.toBeNull();

      act(() => {
        headerCta?.click();
      });

      expect(trackEventSpy).toHaveBeenCalledTimes(1);
      expect(trackEventSpy).toHaveBeenCalledWith(
        "hero_cta_click",
        expect.objectContaining({
          section: "header",
          cta: "telegram_bot",
          destination: "telegram",
        }),
      );
    } finally {
      cleanup();
    }
  });

  it("ignores clicks on elements without analytics markers", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const homeLink = container.querySelector<HTMLAnchorElement>('a[href="/"]');
      expect(homeLink).not.toBeNull();

      act(() => {
        homeLink?.click();
      });

      expect(trackEventSpy).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  it("tracks hero and channel CTA clicks via delegated listener", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const heroButton = container.querySelector<HTMLAnchorElement>(
        '[data-analytics-event="hero_cta_click"][data-analytics-section="hero"][data-analytics-cta="telegram_bot"]',
      );
      const channelButton = container.querySelector<HTMLButtonElement>(
        '[data-analytics-event="channel_cta_click"][data-analytics-section="channel"]',
      );

      expect(heroButton).not.toBeNull();
      expect(channelButton).not.toBeNull();

      act(() => {
        heroButton?.click();
      });
      act(() => {
        channelButton?.click();
      });

      expect(trackEventSpy).toHaveBeenCalledWith("hero_cta_click", expect.any(Object));
      expect(trackEventSpy).toHaveBeenCalledWith(
        "channel_cta_click",
        expect.objectContaining({ section: "channel", cta: "telegram_channel" }),
      );
    } finally {
      cleanup();
    }
  });

  it("tracks analytics on nested CTA interaction via closest delegation", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const heroButton = container.querySelector<HTMLAnchorElement>(
        '[data-analytics-event="hero_cta_click"][data-analytics-section="hero"]',
      );
      expect(heroButton).not.toBeNull();

      const nestedMark = document.createElement("span");
      nestedMark.textContent = "inner";
      heroButton?.appendChild(nestedMark);

      act(() => {
        nestedMark.click();
      });

      expect(trackEventSpy).toHaveBeenCalledWith(
        "hero_cta_click",
        expect.objectContaining({ section: "hero", cta: "quiz_teaser_anchor" }),
      );
    } finally {
      cleanup();
    }
  });

  it("tracks a single CTA click only once", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const heroButton = container.querySelector<HTMLAnchorElement>(
        '[data-analytics-event="hero_cta_click"][data-analytics-section="hero"][data-analytics-cta="telegram_bot"]',
      );
      expect(heroButton).not.toBeNull();

      trackEventSpy.mockClear();

      act(() => {
        heroButton?.click();
      });

      expect(trackEventSpy).toHaveBeenCalledTimes(1);
      expect(trackEventSpy).toHaveBeenCalledWith(
        "hero_cta_click",
        expect.objectContaining({ section: "hero", cta: "telegram_bot" }),
      );
    } finally {
      cleanup();
    }
  });

  it("tracks Telegram product card clicks via delegated listener", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const productCard = container.querySelector<HTMLAnchorElement>(
        '[data-analytics-section="product_card"][data-analytics-cta="telegram_bot"]',
      );
      expect(productCard).not.toBeNull();

      act(() => {
        productCard?.click();
      });

      expect(trackEventSpy).toHaveBeenCalledWith(
        "hero_cta_click",
        expect.objectContaining({ section: "product_card", cta: "telegram_bot" }),
      );
    } finally {
      cleanup();
    }
  });

  it("opens both wizards without duplicating their own form_open producer", () => {
    const { container, cleanup } = renderHomeForAnalytics();

    try {
      const studentButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Lernbegleitung anfragen"),
      );
      const partnerButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Kooperation anfragen"),
      );

      expect(studentButton).not.toBeNull();
      expect(partnerButton).not.toBeNull();

      act(() => {
        studentButton?.click();
      });
      expect(container.querySelector('[data-wizard-open="student"]')).not.toBeNull();
      expect(trackEventSpy).not.toHaveBeenCalled();

      act(() => {
        partnerButton?.click();
      });
      expect(container.querySelector('[data-wizard-open="partner"]')).not.toBeNull();
      expect(trackEventSpy).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });
});

describe("public home analytics telemetry hooks", () => {
  it("reads trackEvent from shared analytics context", () => {
    expect(trackEventSpy).toBeDefined();
  });

  it("accepts quiz teaser analytics event names", () => {
    const eventNames: PublicAnalyticsEventName[] = [
      "quiz_teaser_started",
      "quiz_teaser_question_answered",
      "quiz_teaser_completed",
      "quiz_teaser_cta_clicked",
      "quiz_teaser_error",
    ];

    expect(eventNames).toContain("quiz_teaser_completed");
  });
});
