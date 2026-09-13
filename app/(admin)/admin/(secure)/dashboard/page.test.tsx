import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWebsiteAnalyticsOverview } from "@/lib/site-analytics-client";

import DashboardPage from "./page";
import type { WebsiteAnalyticsOverviewData } from "@/lib/site-analytics-contract";

vi.mock("@/lib/site-analytics-client", () => ({
  fetchWebsiteAnalyticsOverview: vi.fn(),
}));

const analyticsData: WebsiteAnalyticsOverviewData = {
  generated_at: "2026-05-12T12:00:00Z",
  days: 7,
  totals: {
    unique_visitors_total: 42,
    page_views_total: 1234,
    telegram_cta_clicks_total: 9,
  },
  daily_series: [
    { date: "2026-05-12", unique_visitors: 42, page_views: 1234, telegram_cta_clicks: 9 },
  ],
  top_pages: [
    { path: "/contact", page_views: 321, unique_visitors: 21, telegram_cta_clicks: 4 },
  ],
};

let cleanup: (() => void) | undefined;

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  cleanup = () => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
  };

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );
  });

  return container;
}

async function flushQueries() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchWebsiteAnalyticsOverview).mockImplementation(async (days) => ({
    ...analyticsData,
    days,
  }));
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("site website analytics dashboard", () => {
  it("renders website totals and tables without requesting or rendering Quiz overview", async () => {
    const container = renderDashboard();
    await flushQueries();

    expect(fetchWebsiteAnalyticsOverview).toHaveBeenCalledExactlyOnceWith(7);
    expect(container.textContent).toContain("Стара статистика сайту");
    expect(container.textContent).toContain("Auswertung für den gewählten Zeitraum.");
    expect(Array.from(container.querySelectorAll("article p:last-child"), (cell) =>
      cell.textContent?.trim(),
    )).toEqual(["42", "1.234", "9"]);

    const rows = Array.from(container.querySelectorAll("tbody tr"), (row) =>
      Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim()),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].slice(1)).toEqual(["42", "1.234", "9"]);
    expect(rows[1]).toEqual(["/contact", "321", "21"]);
    expect(container.textContent).not.toMatch(/Aktive Nutzer|Nutzung wichtiger Funktionen|Umsatz|Erstkauf/);
  });

  it("loads website analytics for each selected period", async () => {
    const container = renderDashboard();
    await flushQueries();

    const selector = container.querySelector("select");
    if (!selector) {
      throw new Error("Period selector is missing");
    }
    expect(Array.from(selector.options, (option) => option.value)).toEqual(["7d", "30d", "90d"]);
    expect(selector.value).toBe("7d");

    for (const days of [30, 90]) {
      act(() => {
        selector.value = `${days}d`;
        selector.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flushQueries();

      expect(fetchWebsiteAnalyticsOverview).toHaveBeenLastCalledWith(days);
      expect(container.textContent).toContain(`Letzte ${days} Tage`);
    }

    expect(fetchWebsiteAnalyticsOverview).toHaveBeenCalledTimes(3);
  });

  it("shows the website loading state until the response arrives", async () => {
    let resolveResponse!: (data: WebsiteAnalyticsOverviewData) => void;
    vi.mocked(fetchWebsiteAnalyticsOverview).mockReturnValueOnce(
      new Promise<WebsiteAnalyticsOverviewData>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const container = renderDashboard();
    expect(container.textContent).toContain("Wird geladen...");

    await act(async () => resolveResponse(analyticsData));
    await flushQueries();

    expect(container.textContent).not.toContain("Wird geladen...");
    expect(container.textContent).toContain("/contact");
  });

  it("shows the website error without a Quiz dashboard error", async () => {
    vi.mocked(fetchWebsiteAnalyticsOverview).mockRejectedValueOnce(new Error("Analytics unavailable"));
    const container = renderDashboard();
    await flushQueries();

    expect(container.textContent).toContain("Website-Analytics konnten nicht geladen werden.");
    expect(container.textContent).toContain("Analytics unavailable");
    expect(container.textContent).not.toContain("Wird geladen...");
    expect(container.textContent).not.toContain("Dashboard-Daten konnten nicht geladen");
  });

  it("preserves zero totals and empty website tables", async () => {
    vi.mocked(fetchWebsiteAnalyticsOverview).mockResolvedValueOnce({
      ...analyticsData,
      totals: { unique_visitors_total: 0, page_views_total: 0, telegram_cta_clicks_total: 0 },
      daily_series: [],
      top_pages: [],
    });
    const container = renderDashboard();
    await flushQueries();

    expect(Array.from(container.querySelectorAll("article p:last-child"), (cell) =>
      cell.textContent?.trim(),
    )).toEqual(["0", "0", "0"]);
    expect(Array.from(container.querySelectorAll("tbody"), (table) =>
      table.textContent?.trim(),
    )).toEqual(["Keine Daten", "Keine Daten"]);
    expect(container.textContent).not.toContain("Website-Analytics konnten nicht geladen werden.");
  });
});
