import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PageObservations } from "./observations";

const emit = vi.fn();
let observer: PageObservations;
let visible: DocumentVisibilityState;
function geometry(element: HTMLElement, bounds: { top: number; height: number; left?: number; width?: number }) {
  vi.spyOn(element, "getClientRects").mockImplementation(() => [element.getBoundingClientRect()] as unknown as DOMRectList);
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => ({ ...bounds, left: bounds.left ?? 0, width: bounds.width ?? 100, right: (bounds.left ?? 0) + (bounds.width ?? 100), bottom: bounds.top + bounds.height }) as DOMRect);
  return bounds;
}
beforeEach(() => {
  emit.mockReset(); observer = new PageObservations(emit, 0); visible = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.stubGlobal("innerHeight", 1000); vi.stubGlobal("innerWidth", 1000);
});
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("requires continuous >=50% visibility for 1s and deduplicates element/placement per view", () => {
  document.body.innerHTML = '<button data-analytics-id="book_print" data-analytics-placement="books">Private DOM text</button>';
  const rect = geometry(document.querySelector("button")!, { top: 951, height: 100 });
  observer.sample(0, 0); observer.sample(0, 2000); expect(emit).not.toHaveBeenCalled();
  rect.top = 950; observer.sample(0, 2001); observer.sample(0, 3000); expect(emit).not.toHaveBeenCalled();
  observer.sample(0, 3001); observer.sample(0, 9000);
  expect(emit).toHaveBeenCalledExactlyOnceWith("element_impression", { element_id: "book_print", placement: "books" });
});
it("hidden tabs reset impression dwell; unmarked and unknown IDs are ignored", () => {
  document.body.innerHTML = '<button data-analytics-id="telegram_bot" data-analytics-placement="hero">x</button><button data-analytics-id="private_person" data-analytics-placement="hero">y</button>';
  for (const element of document.querySelectorAll("button")) geometry(element, { top: 10, height: 100 });
  observer.sample(0, 0); visible = "hidden"; observer.sample(0, 999); visible = "visible";
  observer.sample(0, 1001); observer.sample(0, 2000); expect(emit).not.toHaveBeenCalled();
  observer.sample(0, 2001); expect(emit).toHaveBeenCalledTimes(1);
});
it("emits each main-content threshold once and cumulative engagement at most every 30s", () => {
  document.body.innerHTML = '<main></main><footer></footer>';
  const rect = geometry(document.querySelector("main")!, { top: 0, height: 4000 });
  observer.sample(1000, 1000); rect.top = -2600; observer.sample(29_000, 29_000);
  observer.sample(30_000, 30_000); observer.sample(60_000, 60_000); observer.sample(60_000, 90_000);
  expect(emit.mock.calls.filter(([name]) => name === "scroll_depth").map(([, data]) => data.threshold)).toEqual([25, 50, 75, 90]);
  expect(emit.mock.calls.filter(([name]) => name === "engagement").map(([, data]) => data.active_ms)).toEqual([30_000, 60_000]);
});
it("footer plus 60 active seconds cannot imply reading closed or merely opened sections", () => {
  document.body.innerHTML = '<main><div data-analytics-content data-analytics-article="deutsche-sprache-geschichte"><div class="era-card"><div class="era-body"></div></div></div></main>';
  geometry(document.querySelector<HTMLElement>("[data-analytics-content]")!, { top: -5000, height: 4000 });
  const body = document.querySelector<HTMLElement>(".era-body")!;
  const bounds = geometry(body, { top: -2000, height: 2000 });
  observer.sample(60_000, 60_000);
  body.parentElement!.classList.add("open"); observer.sample(60_000, 60_100);
  expect(emit.mock.calls.some(([name]) => name === "article_read")).toBe(false);
  bounds.top = 0; observer.sample(60_000, 61_000); bounds.top = -1000; observer.sample(60_000, 62_000); observer.sample(70_000, 70_000);
  expect(emit.mock.calls.filter(([name]) => name === "article_read")).toEqual([["article_read", { article_id: "deutsche-sprache-geschichte", rule_version: 1 }]]);
});
it("requires 60s even after the opened material was covered", () => {
  document.body.innerHTML = '<main data-analytics-content data-analytics-article="sprachniveaus-a0-c2"></main>';
  geometry(document.querySelector("main")!, { top: 0, height: 1000 });
  observer.sample(59_999, 60_000); expect(emit.mock.calls.some(([name]) => name === "article_read")).toBe(false);
  observer.sample(60_000, 61_000); expect(emit.mock.calls.some(([name]) => name === "article_read")).toBe(true);
});
