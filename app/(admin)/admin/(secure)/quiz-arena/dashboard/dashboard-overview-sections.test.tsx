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

    expect(markup).toContain("Keine Daten");
    expect(markup).toContain("1 kpi-karten fehlen oder sind ungültig.");
    expect(markup).toContain("Berlin-Zeit · 3 von 24 Stundenfenstern");
    expect(markup).toContain(
      "3 von 24 Berliner Stundenfenstern sind vorhanden. Fehlende Buckets wurden nicht als 0 ergänzt.",
    );
    expect(markup).toContain(
      "Durchschnitt über die vorhandenen Berliner Stundenfenster. Fehlende Buckets wurden nicht als 0 ergänzt.",
    );
  });

  it("renders real zero values for empty but valid statistics", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(emptyOverviewFixture));
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup).toContain(
      'Aktive Nutzer (24h)</p><p class="mt-2 text-2xl font-semibold">0</p>',
    );
    expect(markup).toContain("Aktuell keine kritischen Warnungen.");
    expect(markup).toContain("Im gewählten Zeitraum wurden keine aktiven Nutzer erfasst.");
  });

  it("renders user language distribution and unavailable demographic sources", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(overviewFixture));
    const markup = renderToStaticMarkup(
      React.createElement(DashboardOverviewSections, { model }),
    );

    expect(markup).toContain("Nutzer nach Sprache");
    expect(markup).toContain("Deutsch");
    expect(markup).toContain("66,7%");
    expect(markup).toContain(
      "Alter kann aktuell nicht ausgewertet werden, weil das Backend kein Alter am Nutzer speichert.",
    );
    expect(markup).toContain(
      "Geschlecht kann aktuell nicht ausgewertet werden, weil das Backend kein Geschlecht am Nutzer speichert.",
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

    expect(markup.indexOf("Neue Nutzer: 2 Nutzer")).toBeLessThan(
      markup.indexOf("Erstes Quiz: 1 Nutzer"),
    );
    expect(markup).toContain("50% relativ zur vorherigen Stufe im selben Zeitraum");
  });
});
