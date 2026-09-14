import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import OverviewPage from "./overview/page";
import SessionPage from "./sessions/[sessionId]/page";
import { fetchDeutschmitOverview, fetchDeutschmitSessions, fetchDeutschmitSession } from "@/lib/deutschmit-analytics-client";

vi.mock("@/lib/deutschmit-analytics-client", () => ({ fetchDeutschmitOverview: vi.fn(), fetchDeutschmitSessions: vi.fn(), fetchDeutschmitSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ sessionId: "11111111-1111-4111-8111-111111111111" }), useSearchParams: () => new URLSearchParams("days=7"), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("recharts", () => Object.fromEntries(["CartesianGrid", "Legend", "Line", "LineChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis"].map(name => [name, () => null])));

const sessionId = "11111111-1111-4111-8111-111111111111";
const meta = { product_id: "deutschmit", days: 7, generated_at: "2026-09-14T12:00:00Z", period_start: "2026-09-08T00:00:00Z", history_available_from: "2026-09-01T10:00:00Z", last_received_at: "2026-09-14T11:00:00Z" };
afterEach(() => vi.resetAllMocks());

async function render(page: React.ReactNode, check: (container: HTMLDivElement) => Promise<void>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}>{page}</QueryClientProvider>));
    await check(container);
  } finally { act(() => root.unmount()); client.clear(); }
}

it("shows recent visits and links to their actions and page filter with the selected period", async () => {
  vi.mocked(fetchDeutschmitOverview).mockResolvedValue({ ...meta, totals: { visitors: 1, sessions: 1, page_views: 2, telegram_clicks: 1, analytics_conversions: 0 }, daily_series: [], top_pages: [{ path: "/wissen", page_views: 2, unique_visitors: 1, telegram_clicks: 1 }] } as never);
  vi.mocked(fetchDeutschmitSessions).mockResolvedValue({ ...meta, items: [{ session_id: sessionId, started_at: "2026-09-14T10:30:00Z", first_page: "/", last_page: "/wissen", page_views: 2, telegram_clicks: 1, analytics_conversions: 0, quiz_completions: 0 }] } as never);
  await render(<OverviewPage />, async container => {
    await vi.waitFor(() => expect(container.textContent).toContain("14.09.26, 10:30 UTC"));
    const links = Array.from(container.querySelectorAll("a"), link => new URL(link.href));
    expect(links.some(url => url.pathname === `/admin/deutschmit/sessions/${sessionId}` && url.searchParams.get("days") === "7")).toBe(true);
    const pageLink = links.find(url => url.searchParams.has("selection"))!;
    expect(JSON.parse(pageLink.searchParams.get("selection")!)).toEqual({ kind: "page", path: "/wissen" });
    expect(pageLink.searchParams.get("days")).toBe("7");
    expect(container.textContent).toContain("Останні відвідування");
    expect(container.textContent).not.toMatch(/Overview|Sessions|Keine|Tage/);
  });
});

it("renders actions in Ukrainian and retains events outside the selected period", async () => {
  vi.mocked(fetchDeutschmitSession).mockResolvedValue({ ...meta, summary: null, events: [
    { event_id: "old", event_name: "page_view", occurred_at: "2026-09-01T10:00:00Z", received_at: "2026-09-01T10:00:01Z", path: "/", source: "browser", metadata: {} },
    { event_id: "new", event_name: "element_click", occurred_at: "2026-09-14T10:00:00Z", received_at: "2026-09-14T10:00:01Z", path: "/wissen", source: "browser", metadata: { destination: "telegram", element_id: "telegram_bot" } },
  ] } as never);
  await render(<SessionPage />, async container => {
    await vi.waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(2));
    expect(container.textContent).toContain("Сторінку відкрито");
    expect(container.textContent).toContain("Натискання: Telegram · Quiz Arena Bot");
    expect(container.textContent).toContain("Поза вибраним періодом");
    expect(container.textContent).not.toMatch(/Chronologische|Außerhalb|Timeline|server|browser/);
    expect(fetchDeutschmitSession).toHaveBeenCalledWith(sessionId);
  });
});
