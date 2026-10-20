import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDeutschmitSession } from "@/lib/deutschmit-analytics-client";
import SessionDetailPage from "./[sessionId]/page";

vi.mock("@/lib/deutschmit-analytics-client", () => ({ fetchDeutschmitSession: vi.fn() }));

const navigation = vi.hoisted(() => ({ sessionId: "11111111-1111-4111-8111-111111111111", query: "days=90", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: navigation.sessionId }),
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ replace: navigation.replace }),
}));

const sessionId = "11111111-1111-4111-8111-111111111111";
const baseEvent = {
  product_id: "deutschmit",
  event_id: "22222222-2222-4222-8222-222222222222",
  schema_version: 1,
  visitor_id: "33333333-3333-4333-8333-333333333333",
  session_id: sessionId,
  page_view_id: "44444444-4444-4444-8444-444444444444",
  sequence: 1,
  occurred_at: "2026-09-14T10:00:00Z",
  path: "/wissen",
  source: "browser",
  received_at: "2026-09-14T10:00:01Z",
  metadata: {},
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  navigation.query = "days=90";
  navigation.replace.mockReset();
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
  await act(async () => root.render(<QueryClientProvider client={client}><SessionDetailPage /></QueryClientProvider>));
}

async function until(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assertion();
  }, { timeout: 2000, interval: 10 });
}

function event(event_name: string, metadata: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  return { ...baseEvent, event_id: crypto.randomUUID(), event_name, metadata, ...overrides };
}

describe("Deutschmit session detail page", () => {
  it("renders summary, incomplete warning, form metadata and every timeline label family", async () => {
    vi.mocked(fetchDeutschmitSession).mockResolvedValue({
      product_id: "deutschmit",
      session_id: sessionId,
      generated_at: "2026-09-14T12:00:00Z",
      last_received_at: "2026-09-14T11:00:00Z",
      history_available_from: "2026-09-01T00:00:00Z",
      summary: {
        session_id: sessionId,
        started_at: "2026-09-14T09:00:00Z",
        last_activity_at: null,
        status: "active",
        incomplete: true,
        first_page: "/",
        last_page: "/wissen",
        entry_source: "newsletter",
        page_views: 3,
        active_ms: 65000,
        telegram_clicks: 1,
        analytics_conversions: 1,
        quiz_completions: 1,
        event_count: 12,
        outcome: "conversion",
      },
      events: [
        event("session_start"),
        event("page_view"),
        event("form_open", { form_id: "student" }),
        event("form_submit", { form_id: "student", submission_attempt_id: "55555555-5555-4555-8555-555555555555" }),
        event("form_error", { form_id: "student", error_code: "validation_error" }),
        event("form_success", { form_id: "student", submission_attempt_id: "55555555-5555-4555-8555-555555555555", conversion_id: "66666666-6666-4666-8666-666666666666" }, { source: "server", sequence: null }),
        event("element_impression", { element_id: "telegram_bot" }),
        event("element_click", { destination: "telegram", element_id: "telegram_bot" }),
        event("scroll_depth", { threshold: 75 }),
        event("engagement", { active_ms: 65000 }),
        event("page_leave", { active_ms: 65000, scroll_percent: 90 }),
        event("article_read"),
        event("quiz_started"),
        event("quiz_completed"),
        event("frontend_error"),
      ],
    } as never);

    await show();
    await until(() => expect(container.querySelectorAll("article")).toHaveLength(15));
    expect(fetchDeutschmitSession).toHaveBeenCalledWith(sessionId);
    expect(container.textContent).toContain("Відвідування · Активне на час звіту");
    expect(container.textContent).toContain("Спостереження неповні");
    expect(container.textContent).toContain("Немає даних");
    expect(container.textContent).toContain("Відвідування розпочато");
    expect(container.textContent).toContain("Форму відкрито");
    expect(container.textContent).toContain("Форму надіслано");
    expect(container.textContent).toContain("Помилка форми");
    expect(container.textContent).toContain("Заявку збережено");
    expect(container.textContent).toContain("Показ: Quiz Arena Bot");
    expect(container.textContent).toContain("Натискання: Telegram · Quiz Arena Bot");
    expect(container.textContent).toContain("Прокручування: 75%");
    expect(container.textContent).toContain("Активний час: 1 хв 5 с");
    expect(container.textContent).toContain("Сторінку закрито");
    expect(container.textContent).toContain("Ознака прочитання статті");
    expect(container.textContent).toContain("Вікторину розпочато");
    expect(container.textContent).toContain("Вікторину завершено");
    expect(container.textContent).toContain("Помилка сайту");

    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>("select")!;
      select.value = "30";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(navigation.replace).toHaveBeenCalledWith("?days=30");
  });

  it("keeps empty history and empty event lists explicit", async () => {
    vi.mocked(fetchDeutschmitSession).mockResolvedValue({
      product_id: "deutschmit",
      session_id: sessionId,
      generated_at: "2026-09-14T12:00:00Z",
      last_received_at: null,
      history_available_from: null,
      summary: null,
      events: [],
    } as never);

    await show();
    await until(() => expect(container.textContent).toContain("Збережених спостережень ще немає"));
    expect(container.textContent).toContain("Для цього відвідування немає збережених дій");
  });
});
