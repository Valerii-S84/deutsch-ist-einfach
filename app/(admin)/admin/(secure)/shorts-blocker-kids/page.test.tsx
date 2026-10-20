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

it("renders populated report tables, pagination and truncated visit details", async () => {
  const session = "0dbb2687-6c58-4f12-9d2e-52497c1ba9bd";
  vi.mocked(readShortsStatistics).mockResolvedValueOnce({
    product_id: "shorts-blocker-kids",
    days: 90,
    page: 2,
    generated_at: "2026-09-14T12:00:00.000Z",
    history_available_from: "2026-09-01T00:00:00.000Z",
    last_received_at: "2026-09-14T11:00:00.000Z",
    totals: { visitors: 4, sessions: 125, page_views: 9, clicks: 3 },
    pages: [{ path: "/", views: 7, clicks: 2 }, { path: "/privacy/", views: 2, clicks: 1 }],
    elements: [{ element_id: "email", clicks: 2 }, { element_id: "preview_button", clicks: 1 }],
    sources: [{ host: null, sessions: 3 }, { host: "example.com", sessions: 1 }],
    sessions: [{ session_id: session, visitor_id: "11111111-1111-4111-8111-111111111111", first_at: "2026-09-14T10:00:00.000Z", last_at: "2026-09-14T10:03:00.000Z", views: 2, clicks: 1 }],
    selected_session: session,
    events: [
      { event_id: "22222222-2222-4222-8222-222222222222", event_name: "page_view", occurred_at: "2026-09-14T10:00:00.000Z", path: "/", element_id: null, active_ms: null },
      { event_id: "33333333-3333-4333-8333-333333333333", event_name: "element_click", occurred_at: "2026-09-14T10:01:00.000Z", path: "/privacy/", element_id: "email", active_ms: null },
      { event_id: "44444444-4444-4444-8444-444444444444", event_name: "page_leave", occurred_at: "2026-09-14T10:02:00.000Z", path: "/support/", element_id: null, active_ms: 6400 },
    ],
    events_truncated: true,
  });

  const html = renderToStaticMarkup(await ShortsStatistics({ searchParams: Promise.resolve({ days: "90", page: "2", session }) }));
  expect(readShortsStatistics).toHaveBeenCalledWith(90, 2, session);
  expect(html).toContain("Головна");
  expect(html).toContain("Конфіденційність");
  expect(html).toContain("Написати на пошту");
  expect(html).toContain("Прямий перехід або джерело невідоме");
  expect(html).toContain("example.com");
  expect(html).toContain("?days=90&amp;page=1");
  expect(html).toContain("?days=90&amp;page=3");
  expect(html).toContain("Показано перші 1000 подій");
  expect(html).toContain("Підсумок активного часу");
  expect(html).toContain("6 с активного часу");
});

it("keeps unavailable source explicit and normalizes malformed days/page params", async () => {
  vi.mocked(readShortsStatistics).mockRejectedValueOnce(new Error("offline"));
  const html = renderToStaticMarkup(await ShortsStatistics({ searchParams: Promise.resolve({ days: "14", page: "0" }) }));

  expect(readShortsStatistics).toHaveBeenCalledWith(7, 1, undefined);
  expect(html).toContain("Джерело статистики недоступне");
  expect(html).toContain("не означає нульову активність");
});
