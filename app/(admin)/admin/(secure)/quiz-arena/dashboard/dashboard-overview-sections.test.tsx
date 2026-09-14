import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import emptyOverviewFixture from "@/docs/statistics-fixtures/admin-overview-empty-7d.json";
import overviewFixture from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
import { parseOverviewPayloadSections } from "@/lib/quiz-arena-statistics";

import { normalizeOverviewData } from "./dashboard-normalization";

vi.mock("recharts", async () => {
  function MockChart() {
    return null;
  }

  return {
    Area: MockChart,
    AreaChart: MockChart,
    Bar: MockChart,
    BarChart: MockChart,
    CartesianGrid: MockChart,
    Cell: MockChart,
    Line: MockChart,
    LineChart: MockChart,
    Pie: MockChart,
    PieChart: MockChart,
    ResponsiveContainer: MockChart,
    Tooltip: MockChart,
    XAxis: MockChart,
    YAxis: MockChart,
  };
});

import { DashboardOverviewSections } from "./dashboard-overview-sections";

describe("DashboardOverviewSections", () => {
  it("renders partial KPI and hourly coverage states explicitly", () => {
    const { dau: _dau, ...kpisWithoutDau } = overviewFixture.kpis;
    const model = normalizeOverviewData(
      parseOverviewPayloadSections({
        ...overviewFixture,
        kpis: kpisWithoutDau,
        hourly_activity_series: overviewFixture.hourly_activity_series.filter(
          (item) => item.active_users > 0,
        ),
      }),
    );
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup).toContain("Немає даних");
    expect(markup).toContain("1 показники відсутні або некоректні.");
    expect(markup).toContain("Час Берліна · 3 із 24 годин");
    expect(markup).toContain(
      "3 із 24 годин за часом Берліна мають дані. Пропущені години не доповнюються нулями.",
    );
    expect(markup).toContain(
      "Середнє за наявними годинами за часом Берліна. Пропущені години не доповнюються нулями.",
    );
  });

  it("renders real zero values for empty but valid statistics", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(emptyOverviewFixture));
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup).toContain(
      'Активні за 24 години</p><p class="mt-2 text-2xl font-semibold">0</p>',
    );
    expect(markup).toContain("Критичних попереджень немає.");
    expect(markup).toContain("За вибраний період активних користувачів не зафіксовано.");
  });

  it("renders user language distribution and unavailable demographic sources", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(overviewFixture));
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup).toContain("Мови користувачів");
    expect(markup).toContain("Німецька");
    expect(markup).toContain("66,7%");
    expect(markup).toContain(
      "Вік користувачів не зберігається, тому вікова статистика недоступна.",
    );
    expect(markup).toContain(
      "Стать користувачів не зберігається, тому відповідна статистика недоступна.",
    );
  });

  it("renders funnel milestones in normalized order with stable conversion copy", () => {
    const model = normalizeOverviewData(
      parseOverviewPayloadSections({
        ...overviewFixture,
        funnel: [
          overviewFixture.funnel[3],
          overviewFixture.funnel[1],
          overviewFixture.funnel[0],
          overviewFixture.funnel[2],
        ],
      }),
    );
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup.indexOf("Нові користувачі: 2 Користувачі")).toBeLessThan(
      markup.indexOf("Перша вікторина: 1 Користувачі"),
    );
    expect(markup).toContain("50% від попереднього кроку за той самий період");
  });
});
