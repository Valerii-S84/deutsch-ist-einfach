import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("recharts", () => {
  const Empty = () => null;
  return Object.fromEntries(["Cell", "Line", "LineChart", "Pie", "PieChart", "ResponsiveContainer", "Tooltip", "XAxis", "YAxis", "Area", "AreaChart", "Bar", "BarChart", "CartesianGrid"].map(name => [name, Empty]));
});
import Users from "./users/page";
import Content from "./content/page";
import Economy from "./economy/page";
import System from "./system/page";
import Dashboard from "./dashboard/page";
import { DataFreshness } from "./data-freshness";
beforeEach(() => vi.mocked(useQuery).mockReturnValue({ data: undefined, error: new Error("offline"), isLoading: false, dataUpdatedAt: Date.now() } as never));

function queryResult<T>(data: T, extra: Record<string, unknown> = {}) {
  return { data, error: null, isLoading: false, isFetching: false, dataUpdatedAt: Date.now(), ...extra } as never;
}

function changeControl(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

describe("failed product queries never render zero cards", () => {
  it.each([Users, Content, Economy, System])("shows an isolated error for %s", Page => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Значення не відображаються");
    expect(html).not.toContain("Stabil");
    expect(html).not.toContain("Gesamtzustand");
  });
  it("keeps the dashboard period control available after a failure", () => {
    const html = renderToStaticMarkup(<Dashboard />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('value="7d"');
    expect(html).toContain('value="30d"');
    expect(html).toContain('value="90d"');
    expect(html).not.toContain("Umsatz in Sternen");
  });
  it("renders an explicit successful empty users result", () => {
    vi.mocked(useQuery).mockReturnValue({ data: { items: [], total: 0, page: 1, pages: 0 }, isLoading: false, dataUpdatedAt: Date.now() } as never);
    const html = renderToStaticMarkup(<Users />);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Registrierte Nutzer");
  });
  it("distinguishes unknown source freshness from an old snapshot", () => {
    expect(renderToStaticMarkup(<DataFreshness receivedAt={Date.now()} />)).toContain("свіжість джерела невідома");
    expect(renderToStaticMarkup(<DataFreshness receivedAt={Date.now()} generatedAt="2020-01-01T00:00:00Z" />)).toContain("Застарілі дані");
  });
});

describe("successful Quiz Arena admin pages", () => {
  it("summarizes content quality, CEFR sorting, flags, duplicates and grammar pipeline state", () => {
    vi.mocked(useQuery).mockReturnValue(queryResult({
      level_stats: [
        { level: "B1", total_questions: 10, attempts: 20, coverage_percent: 125 },
        { level: "A1", total_questions: 5, attempts: 3, coverage_percent: 50 },
      ],
      flagged_questions: [
        { id: 1, user_id: 10, reason: "question_flagged", payload: {}, created_at: "2026-09-14T08:00:00Z" },
        { id: 2, user_id: 11, reason: "question_duplicate", payload: {}, created_at: "2026-09-14T09:00:00Z" },
        { id: 3, user_id: 12, reason: "grammar_flagged", payload: {}, created_at: "2026-09-14T10:00:00Z" },
        { id: 4, user_id: 13, reason: "custom_reason", payload: {}, created_at: "2026-09-14T11:00:00Z" },
      ],
      grammar_pipeline: {
        status: "warning",
        updated_at: "2026-09-14T12:00:00Z",
        payload: { mode: "dry-run", count: 3, enabled: true, empty: null, nested: { ok: true } },
      },
      duplicates: [{ question_text: "Wie geht es dir?", count: 2 }],
      mode_level_distribution: [
        { mode_code: "QUICK_MIX_A1A2", level: "B1", attempts: 6, percent_in_mode: 60, percent_of_all_attempts: 30 },
        { mode_code: "QUICK_MIX_A1A2", level: "A1", attempts: 4, percent_in_mode: 40, percent_of_all_attempts: 20 },
        { mode_code: "CUSTOM_MODE", level: "C2", attempts: 10, percent_in_mode: 100, percent_of_all_attempts: 50 },
      ],
    }));

    const html = renderToStaticMarkup(<Content />);
    expect(html).toContain("Fragen gesamt");
    expect(html).toContain(">15<");
    expect(html).toContain("23");
    expect(html.indexOf("A1")).toBeLessThan(html.indexOf("B1"));
    expect(html).toContain("Quick Mix A1-A2");
    expect(html).toContain("CUSTOM MODE");
    expect(html).toContain("Warnung");
    expect(html).toContain("dry-run");
    expect(html).toContain("Unklare Frage gemeldet");
    expect(html).toContain("Doppelte Frage gemeldet");
    expect(html).toContain("Grammatikproblem gemeldet");
    expect(html).toContain("custom_reason");
    expect(html).toContain("Wie geht es dir?");
    expect(html).not.toContain("Keine Duplikate erkannt");
  });

  it("renders economy revenue, cohorts, premium subscriptions and purchase status semantics", () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce(queryResult({
        total: 3,
        page: 1,
        pages: 1,
        charts: {
          revenue_by_product: [
            { product: "PREMIUM_MONTH", stars: 1000, eur: 99 },
            { product: "ENERGY_10", stars: 500, eur: 24.5 },
          ],
          ltv_30d_by_cohort: [{ cohort_week: "2026-W36", cohort_size: 5, revenue_stars_30d: 250, ltv_stars_30d: 50, ltv_eur_30d: 4.5 }],
        },
        items: [
          { id: "p1", user_id: 1, username: "anna", product: "PREMIUM_MONTH", stars: 1000, eur: 99, date: "2026-09-14T08:00:00Z", source: "telegram", utm: null, status: "CREDITED" },
          { id: "p2", user_id: 2, username: null, product: "ENERGY_10", stars: 500, eur: 24.5, date: null, source: "web", utm: null, status: "PAID_UNCREDITED" },
          { id: "p3", user_id: 3, username: "bea", product: "CUSTOM_PACK", stars: 0, eur: 0, date: null, source: "api", utm: null, status: "FAILED" },
        ],
      }, { dataUpdatedAt: 3000 }))
      .mockReturnValueOnce(queryResult({
        total: 2,
        items: [
          { id: 1, user_id: 1, username: "anna", status: "ACTIVE", starts_at: "2026-09-01T00:00:00Z", ends_at: null },
          { id: 2, user_id: 2, username: null, status: "ACTIVE", starts_at: "2026-08-01T00:00:00Z", ends_at: "2020-01-01T00:00:00Z" },
        ],
      }, { dataUpdatedAt: 1000 }))
      .mockReturnValueOnce(queryResult({
        week_offsets: [0, 1, 2, 4, 8],
        cohorts: [
          { cohort_week: "2026-W36", users: 10, w0: 10, w1: 20, w2: 30, w4: 40, w8: 50 },
          { cohort_week: "2026-W35", users: 8, w0: 20, w1: 30, w2: 40, w4: 50 },
        ],
      }, { dataUpdatedAt: 2000 }));

    const html = renderToStaticMarkup(<Economy />);
    expect(html).toContain("Umsatz &amp; Käufe");
    expect(html).toContain("1.500 Sterne");
    expect(html).toContain("Premium Monat");
    expect(html).toContain("Energie +10");
    expect(html).toContain("66,7%");
    expect(html).toContain("15%");
    expect(html).toContain("Keine Daten");
    expect(html).toContain("Unbegrenzt");
    expect(html).toContain("Abgelaufen");
    expect(html).toContain("Abgeschlossen");
    expect(html).toContain("Bezahlt (wird verbucht)");
    expect(html).toContain("Fehlgeschlagen");
    expect(html).toContain("API");
  });

  it("keeps content and economy empty states distinct from missing data", () => {
    vi.mocked(useQuery).mockReturnValue(queryResult({
      level_stats: [],
      flagged_questions: [],
      grammar_pipeline: { status: "healthy", updated_at: null, payload: {} },
      duplicates: [],
      mode_level_distribution: [],
    }));
    const contentHtml = renderToStaticMarkup(<Content />);
    expect(contentHtml).toContain(">0<");
    expect(contentHtml).toContain("Stabil");
    expect(contentHtml).toContain("Aktualisiert: -");
    expect(contentHtml).toContain("Noch keine Antworten in den Daten vorhanden");
    expect(contentHtml).toContain("Keine Zusatzdetails vorhanden");
    expect(contentHtml).toContain("Keine Duplikate erkannt");
    expect(contentHtml).toContain("Aktuell liegen keine Meldungen vor");

    vi.mocked(useQuery)
      .mockReturnValueOnce(queryResult({ total: 0, page: 1, pages: 1, charts: { revenue_by_product: [], ltv_30d_by_cohort: [] }, items: [] }))
      .mockReturnValueOnce(queryResult({ total: 0, items: [] }))
      .mockReturnValueOnce(queryResult({ week_offsets: [], cohorts: [] }));
    const economyHtml = renderToStaticMarkup(<Economy />);
    expect(economyHtml).toContain("Nicht definiert (keine Käufe)");
    expect(economyHtml).toContain("Nicht definiert (kein Umsatz)");
    expect(economyHtml).toContain("Keine Daten");
    expect(economyHtml).toContain("Noch keine Kohorten-Daten vorhanden");
    expect(economyHtml).toContain("Keine aktiven Premium-Abos gefunden");
  });

  it("keeps system status explicit for degraded services, queues, latency and empty logs", () => {
    vi.mocked(useQuery).mockReturnValue(queryResult({
      services: {
        fastapi: { ok: true },
        redis: { ok: false },
        celery: { ok: true, workers: ["worker-a", "worker-b"] },
        bot_webhook: { ok: true, processed_updates_15m: 0 },
      },
      error_log: [{ event_type: "telegram_send_failed", status: "FAILED", created_at: "2026-09-14T08:00:00Z" }],
      top_10_errors: [{ type: "payment_failed", count: 3 }, { type: "quiz_timeout", count: 1 }],
      queue_stats: { pending: 250, failed: 2 },
      api_latency: [{ date: "2026-09-13", p50: null, p95: null }, { date: "2026-09-14", p50: 800, p95: 2100 }],
    }));

    const degraded = renderToStaticMarkup(<System />);
    expect(degraded).toContain("Achtung");
    expect(degraded).toContain("3/4 Dienste verfuegbar");
    expect(degraded).toContain("Redis Cache");
    expect(degraded).toContain("Kritisch hoch");
    expect(degraded).toContain("Fehlgeschlagene Jobs vorhanden");
    expect(degraded).toContain("Queue ist hoch");
    expect(degraded).toContain("telegram send failed");

    vi.mocked(useQuery).mockReturnValue(queryResult({
      services: { fastapi: { ok: true }, postgresql: { ok: true } },
      error_log: [],
      top_10_errors: [],
      queue_stats: { pending: 0, failed: 0 },
      api_latency: [],
    }));

    const healthy = renderToStaticMarkup(<System />);
    expect(healthy).toContain("Alle Kern-Dienste laufen stabil");
    expect(healthy).toContain("Keine Fehler im aktuellen Zeitraum");
    expect(healthy).toContain("Keine Outbox-Fehler");
    expect(healthy).toContain("API p95: - ms (Keine Daten)");

    vi.mocked(useQuery).mockReturnValue(queryResult({
      services: { fastapi: { ok: true }, redis: { ok: true }, celery: { ok: true, workers: [] }, bot_webhook: { ok: true, processed_updates_15m: 12 } },
      error_log: [],
      top_10_errors: [{ type: "slow_query", count: 1 }],
      queue_stats: { pending: 5, failed: 0 },
      api_latency: [{ date: "2026-09-14", p50: 600, p95: 1500 }],
    }));
    expect(renderToStaticMarkup(<System />)).toContain("Erhoeht");

    vi.mocked(useQuery).mockReturnValue(queryResult({
      services: { fastapi: { ok: true }, redis: { ok: true }, celery: { ok: true, workers: [] }, bot_webhook: { ok: true, processed_updates_15m: 12 } },
      error_log: [],
      top_10_errors: [{ type: "slow_query", count: 1 }],
      queue_stats: { pending: 5, failed: 0 },
      api_latency: [{ date: "2026-09-14", p50: 100, p95: 500 }],
    }));
    expect(renderToStaticMarkup(<System />)).toContain("Normal");
  });

  it("renders users table fallbacks, status badges, paging summary and score mode interactions", async () => {
    const users = [
      { id: 1, telegram_user_id: 101, username: "anna", first_name: "Anna", language: "de", status: "ACTIVE", created_at: "2026-09-01T00:00:00Z", last_seen_at: "2026-09-14T08:00:00Z", streak: 5, daily_challenge_score: 100, daily_challenge_completed_runs: 4 },
      { id: 2, telegram_user_id: 102, username: null, first_name: "Ben", language: null, status: "BLOCKED", created_at: "2026-09-02T00:00:00Z", last_seen_at: null, streak: 0, daily_challenge_score: 0, daily_challenge_completed_runs: 0 },
      { id: 3, telegram_user_id: 103, username: null, first_name: null, language: "uk", status: "PENDING", created_at: "2026-09-03T00:00:00Z", last_seen_at: null, streak: 2, daily_challenge_score: 50, daily_challenge_completed_runs: 2 },
    ];
    vi.mocked(useQuery).mockImplementation(((options?: { queryKey?: unknown[] }) => {
      const page = Number(options?.queryKey?.[1] ?? 1);
      return queryResult({ items: users, total: 103, page, pages: 2 }, page === 2 ? { isFetching: true } : {});
    }) as never);

    const container = document.createElement("div");
    let root: Root | undefined;
    try {
      root = createRoot(container);
      await act(async () => root?.render(<Users />));
      expect(container.textContent).toContain("103");
      expect(container.textContent).toContain("1-100");
      expect(container.textContent).toContain("@anna");
      expect(container.textContent).toContain("Ben");
      expect(container.textContent).toContain("Nutzer 3");
      expect(container.textContent).toContain("BLOCKED");
      expect(container.textContent).toContain("Schnitt Daily");
      await act(async () => {
        [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Daily Challenge Ranking"))?.click();
      });
      expect(container.textContent).toContain("Top-Score");
      expect(container.textContent).toContain("Ranking");
      await act(async () => {
        [...container.querySelectorAll("button")].find(button => button.textContent === "Weiter")?.click();
      });
      expect(container.textContent).toContain("Seite 2 / 2");
      expect(container.textContent).toContain("Liste wird aktualisiert");
    } finally {
      if (root) await act(async () => root?.unmount());
    }
  });
});
