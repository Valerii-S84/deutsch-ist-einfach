// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { readShortsStatistics } from "@/lib/server/shorts-statistics";
import ShortsStatistics from "./page";

vi.mock("@/lib/server/shorts-statistics", () => ({ readShortsStatistics: vi.fn() }));
beforeEach(() => {
  vi.mocked(readShortsStatistics).mockReset();
  vi.mocked(readShortsStatistics).mockImplementation(async (days, page, session) => ({
    product_id: "shorts-blocker-kids", days, page,
    generated_at: "2026-09-14T12:00:00.000Z", history_available_from: null, last_received_at: null,
    totals: { visitors: 2, sessions: 3, page_views: 5, clicks: 1 },
    pages: [], elements: [], sources: [], sessions: [], selected_session: session ?? null,
    events: [], events_truncated: false,
  }));
});

it.each([
  "-".repeat(36),
  "f".repeat(36),
  "00000000-0000-0000-0000-000000000000",
  "0dbb2687-6c58-9f12-9d2e-52497c1ba9bd",
  "0dbb2687-6c58-4f12-0d2e-52497c1ba9bd",
])("keeps the dashboard available for a malformed session bookmark: %s", async session => {
  const html = renderToStaticMarkup(await ShortsStatistics({ searchParams: Promise.resolve({ days: "30", session }) }));
  expect(readShortsStatistics).toHaveBeenCalledWith(30, 1, undefined);
  expect(html).toContain("Перегляди сторінок");
  expect(html).not.toContain("Джерело статистики недоступне");
  expect(html).not.toContain('id="visit"');
});

it("preserves a canonical session selection and its detail view", async () => {
  const session = "0dbb2687-6c58-4f12-9d2e-52497c1ba9bd";
  const html = renderToStaticMarkup(await ShortsStatistics({ searchParams: Promise.resolve({ session }) }));
  expect(readShortsStatistics).toHaveBeenCalledWith(7, 1, session);
  expect(html).toContain('id="visit"');
});
