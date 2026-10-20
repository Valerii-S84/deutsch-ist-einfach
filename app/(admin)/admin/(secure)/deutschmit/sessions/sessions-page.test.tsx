import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDeutschmitSessions } from "@/lib/deutschmit-analytics-client";
import SessionsPage from "./page";

vi.mock("@/lib/deutschmit-analytics-client", () => ({ fetchDeutschmitSessions: vi.fn() }));

const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));

const sessionId = "11111111-1111-4111-8111-111111111111";
const meta = {
  product_id: "deutschmit",
  days: 30,
  generated_at: "2026-09-14T12:00:00Z",
  period_start: "2026-08-16T00:00:00Z",
  history_available_from: "2026-08-01T10:00:00Z",
  last_received_at: "2026-09-14T11:00:00Z",
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  navigation.query = "";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

async function show() {
  await act(async () => root.render(<QueryClientProvider client={client}><SessionsPage /></QueryClientProvider>));
}

async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assertion();
  }, { timeout: 2000, interval: 10 });
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    ...meta,
    page: 1,
    page_size: 50,
    pages: 2,
    total: 4,
    filters: { path: null, event_name: null },
    items: [
      { session_id: sessionId, started_at: "2026-09-14T09:00:00Z", last_activity_at: "2026-09-14T09:05:00Z", status: "active", incomplete: true, first_page: "/", last_page: "/contact", entry_source: "newsletter / email / Launch", page_views: 2, active_ms: 65000, telegram_clicks: 0, analytics_conversions: 1, quiz_completions: 0, event_count: 5, outcome: "conversion" },
      { session_id: "22222222-2222-4222-8222-222222222222", started_at: "2026-09-14T08:00:00Z", last_activity_at: null, status: "unknown", incomplete: false, first_page: null, last_page: null, entry_source: "direct", page_views: 0, active_ms: null, telegram_clicks: 0, analytics_conversions: 0, quiz_completions: 1, event_count: 2, outcome: "quiz_completed" },
      { session_id: "33333333-3333-4333-8333-333333333333", started_at: "2026-09-14T07:00:00Z", last_activity_at: "2026-09-14T07:02:00Z", status: "timed_out", incomplete: false, first_page: "/wissen", last_page: "/wissen", entry_source: "telegram", page_views: 1, active_ms: 1000, telegram_clicks: 2, analytics_conversions: 0, quiz_completions: 0, event_count: 3, outcome: "telegram_click" },
      { session_id: "44444444-4444-4444-8444-444444444444", started_at: "2026-09-14T06:00:00Z", last_activity_at: "2026-09-14T06:01:00Z", status: "timed_out", incomplete: false, first_page: "/", last_page: "/", entry_source: "unknown", page_views: 1, active_ms: 0, telegram_clicks: 0, analytics_conversions: 0, quiz_completions: 0, event_count: 1, outcome: "none" },
    ],
    ...overrides,
  };
}

function changeControl(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

describe("Deutschmit sessions page", () => {
  it("hydrates typed report filters and renders every outcome without inventing zero-state data", async () => {
    const selection = { kind: "traffic", referrer_host: null, utm_source: "newsletter", utm_medium: "email", utm_campaign: "Launch" };
    navigation.query = `days=30&selection=${encodeURIComponent(JSON.stringify(selection))}`;
    vi.mocked(fetchDeutschmitSessions).mockResolvedValue(report() as never);

    await show();
    await until(() => expect(container.textContent).toContain("Відвідування: 4"));
    expect(fetchDeutschmitSessions).toHaveBeenCalledWith({ days: 30, page: 1, path: undefined, eventName: null, selection });
    expect(container.textContent).toContain("Фільтр звіту");
    expect(container.textContent).toContain("Заявка (1)");
    expect(container.textContent).toContain("Вікторина (1)");
    expect(container.textContent).toContain("Telegram (2)");
    expect(container.textContent).toContain("Цільових дій не зафіксовано");
    expect(container.textContent).toContain("Неповні спостереження");
    const link = [...container.querySelectorAll("a")].find(item => item.textContent === "Відкрити")!;
    const url = new URL(link.href);
    expect(url.pathname).toBe(`/admin/deutschmit/sessions/${sessionId}`);
    expect(url.searchParams.get("days")).toBe("30");
  });

  it("applies path, event and pagination filters to the next request", async () => {
    vi.mocked(fetchDeutschmitSessions).mockImplementation(async (options: { page: number }) => report({ page: options.page }) as never);

    await show();
    await until(() => expect(container.textContent).toContain("Сторінка 1 із 2"));
    await act(async () => {
      changeControl(container.querySelector<HTMLInputElement>('input[placeholder="/contact"]')!, "/wissen");
      changeControl(container.querySelector<HTMLSelectElement>('select[aria-label="Тип дії"]')!, "page_view");
    });
    await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Застосувати")?.click());
    await until(() => expect(fetchDeutschmitSessions).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/wissen", eventName: "page_view", page: 1 })));
    await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Далі")?.click());
    await until(() => expect(fetchDeutschmitSessions).toHaveBeenLastCalledWith(expect.objectContaining({ path: "/wissen", eventName: "page_view", page: 2 })));
  });

  it("separates invalid filters, empty known periods and missing history", async () => {
    navigation.query = "days=14";
    await show();
    expect(container.textContent).toContain("Некоректний фільтр звіту");
    expect(fetchDeutschmitSessions).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    root = createRoot(container);
    navigation.query = "";
    vi.mocked(fetchDeutschmitSessions).mockResolvedValue(report({ history_available_from: null, total: 0, pages: 1, items: [] }) as never);
    await show();
    await until(() => expect(container.textContent).toContain("Джерело ще не має спостережень"));
    expect(container.textContent).toContain("За вибраним періодом і фільтрами відвідувань не знайдено");
  });
});
