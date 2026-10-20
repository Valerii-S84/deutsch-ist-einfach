import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_ANALYTICS_STORAGE_KEYS,
  removeLegacyAnalyticsStorage,
  trackAttributes,
  umamiBeforeSend,
} from "./umami";

vi.mock("next/script", () => ({ default: vi.fn(() => null) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete window.umami;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("Umami", () => {
  it("does nothing without a website ID", async () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "");
    vi.resetModules();
    const { track } = await import("./umami");
    const send = vi.fn();
    window.umami = { track: send };
    track("telegram-click", { cta: "telegram_bot" });
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing without Umami or window and contains tracker errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "website-id");
    vi.resetModules();
    const { track } = await import("./umami");
    expect(() => track("quiz-start", { day: 1 })).not.toThrow();
    window.umami = { track: () => { throw new Error("tracker unavailable"); } };
    expect(() => track("quiz-start", { day: 1 })).not.toThrow();
    vi.stubGlobal("window", undefined);
    expect(() => track("quiz-start", { day: 1 })).not.toThrow();
    expect(() => removeLegacyAnalyticsStorage()).not.toThrow();
  });

  it("sends an event and its data once", async () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "website-id");
    vi.resetModules();
    const { track } = await import("./umami");
    const send = vi.fn();
    window.umami = { track: send };
    track("quiz-complete", { score: 4, total: 5 });
    expect(send).toHaveBeenCalledExactlyOnceWith("quiz-complete", { score: 4, total: 5 });
  });

  it("builds delegated tracking attributes", () => {
    expect(trackAttributes("telegram-click", { cta: "telegram_bot", placement: "header" })).toEqual({
      "data-track": "telegram-click", "data-track-cta": "telegram_bot", "data-track-placement": "header",
    });
    expect(trackAttributes("youtube-click", { placement: "footer" })).toEqual({ "data-track": "youtube-click", "data-track-placement": "footer" });
    expect(trackAttributes("quiz-start", { day: 2 })).toEqual({ "data-track": "quiz-start", "data-track-day": 2 });
  });

  it.each(["/admin", "/admin/x", "https://deutschmit.de/admin/x?query=1"])("blocks %s", url => {
    expect(umamiBeforeSend("event", { url })).toBe(false);
  });

  it("returns the same public payload and falls back to the current pathname", () => {
    const payload = { url: "/", data: { score: 4 } };
    expect(umamiBeforeSend("event", payload)).toBe(payload);
    vi.stubGlobal("location", { pathname: "/admin/x" });
    expect(umamiBeforeSend("event", {})).toBe(false);
  });

  it("removes all seven legacy keys while keeping quiz progress and unrelated storage", () => {
    for (const storage of ["localStorage", "sessionStorage"] as const) {
      for (const key of LEGACY_ANALYTICS_STORAGE_KEYS[storage]) window[storage].setItem(key, "legacy");
      window[storage].setItem("unrelated", "keep");
    }
    window.localStorage.setItem("quiz_arena_five_question_progress_v1", "progress");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    removeLegacyAnalyticsStorage();
    expect(remove).toHaveBeenCalledTimes(7);
    expect(write).not.toHaveBeenCalled();
    for (const storage of ["localStorage", "sessionStorage"] as const) {
      for (const key of LEGACY_ANALYTICS_STORAGE_KEYS[storage]) expect(window[storage].getItem(key)).toBeNull();
      expect(window[storage].getItem("unrelated")).toBe("keep");
    }
    expect(window.localStorage.getItem("quiz_arena_five_question_progress_v1")).toBe("progress");
  });

  it("contains storage access errors", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked storage"); });
    expect(() => removeLegacyAnalyticsStorage()).not.toThrow();
  });

  it.each(["", "website-id"])("initializes delegated clicks and cleanup with website ID '%s'", async websiteId => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", websiteId);
    vi.resetModules();
    const { act, createElement, StrictMode } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { UmamiScript } = await import("@/app/umami-script");
    const { default: Script } = await import("next/script");
    vi.mocked(Script).mockClear();
    const container = document.createElement("div");
    const link = document.createElement("a");
    link.target = "_blank";
    link.innerHTML = "<span>Telegram</span>";
    for (const [key, value] of Object.entries(trackAttributes("telegram-click", { cta: "telegram_bot", placement: "header" }))) {
      link.setAttribute(key, String(value));
    }
    document.body.append(container, link);
    const root = createRoot(container);
    const send = vi.fn();
    window.umami = { track: send };
    window.localStorage.setItem(LEGACY_ANALYTICS_STORAGE_KEYS.localStorage[0], "legacy");
    try {
      await act(async () => root.render(createElement(StrictMode, null, createElement(UmamiScript))));
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_STORAGE_KEYS.localStorage[0])).toBeNull();
      expect(window.deutschmitUmamiBeforeSend?.("event", { url: "/admin" })).toBe(false);
      if (websiteId) {
        expect(vi.mocked(Script).mock.calls.at(-1)?.[0]).toMatchObject({
          src: "/u/script.js", strategy: "afterInteractive", "data-website-id": websiteId,
          "data-domains": "deutschmit.de", "data-exclude-search": "true", "data-exclude-hash": "true",
          "data-before-send": "deutschmitUmamiBeforeSend",
        });
      } else {
        expect(Script).not.toHaveBeenCalled();
      }
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      link.firstElementChild!.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
      if (websiteId) expect(send).toHaveBeenCalledExactlyOnceWith("telegram-click", { cta: "telegram_bot", placement: "header" });
      else expect(send).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      link.firstElementChild!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(send).toHaveBeenCalledTimes(websiteId ? 1 : 0);
      container.remove();
      link.remove();
      delete window.deutschmitUmamiBeforeSend;
    }
  });
});
