/* @vitest-environment jsdom */

import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicSiteHeader } from "./public-site-header";

function renderInContainer(ui: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function installDesktopMediaQuery() {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches: false,
    media: "(min-width: 1024px)",
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQueryList as unknown as MediaQueryList),
  );

  return {
    setMatches(matches: boolean) {
      mediaQueryList.matches = matches;
      const event = { matches, media: mediaQueryList.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublicSiteHeader mobile navigation", () => {
  it("stays collapsed until the menu button is used and closes on Escape", () => {
    const { container, cleanup } = renderInContainer(<PublicSiteHeader />);

    try {
      const menuButton = container.querySelector<HTMLButtonElement>("button[aria-controls]");
      expect(menuButton).not.toBeNull();
      expect(menuButton?.getAttribute("aria-expanded")).toBe("false");

      const mobileNavigation = document.getElementById(
        menuButton?.getAttribute("aria-controls") ?? "",
      );
      expect(mobileNavigation?.classList.contains("hidden")).toBe(true);

      act(() => menuButton?.click());

      expect(menuButton?.getAttribute("aria-expanded")).toBe("true");
      expect(mobileNavigation?.classList.contains("hidden")).toBe(false);

      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });

      expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(menuButton);
    } finally {
      cleanup();
    }
  });

  it("resets an open mobile menu when the desktop breakpoint becomes active", () => {
    const desktopMediaQuery = installDesktopMediaQuery();
    const { container, cleanup } = renderInContainer(<PublicSiteHeader />);

    try {
      const menuButton = container.querySelector<HTMLButtonElement>("button[aria-controls]");
      act(() => menuButton?.click());
      expect(menuButton?.getAttribute("aria-expanded")).toBe("true");

      act(() => desktopMediaQuery.setMatches(true));
      expect(menuButton?.getAttribute("aria-expanded")).toBe("false");

      act(() => desktopMediaQuery.setMatches(false));
      expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
    } finally {
      cleanup();
    }
  });
});
