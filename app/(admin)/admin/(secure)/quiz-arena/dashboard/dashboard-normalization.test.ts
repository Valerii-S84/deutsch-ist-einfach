import { describe, expect, it } from "vitest";

import emptyOverviewFixture from "@/docs/statistics-fixtures/admin-overview-empty-7d.json";
import overviewFixture from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
import { parseOverviewPayloadSections } from "@/lib/quiz-arena-statistics";

import { FEATURE_USAGE_DEFINITIONS, KPI_DEFINITIONS } from "./dashboard-config";
import { normalizeOverviewData } from "./dashboard-normalization";

describe("normalizeOverviewData", () => {
  it("builds a display model from a validated overview payload", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(overviewFixture));

    expect(model.kpiSection.cards).toHaveLength(KPI_DEFINITIONS.length);
    expect(model.featureUsageSection.cards).toHaveLength(FEATURE_USAGE_DEFINITIONS.length);
    expect(model.kpiSection.status).toBe("valid");
    expect(model.hourlyActivity.status).toBe("valid");
    expect(model.revenueSection.totalRevenueStars).toBe(
      overviewFixture.revenue_series.reduce((sum, item) => sum + item.stars, 0),
    );
    expect(model.funnelSection.items[0]).toMatchObject({
      step: "Start",
      step_label: "Нові користувачі",
      ratio_to_previous: null,
    });
    expect(model.userLanguageSection).toMatchObject({
      status: "valid",
      totalUsers: 3,
      items: [
        {
          key: "de",
          label: "Німецька",
          users: 2,
        },
        {
          key: "en",
          label: "Англійська",
          users: 1,
        },
      ],
    });
    expect(model.userLanguageSection.items[0]?.percent).toBeCloseTo(66.666, 2);
    expect(model.userAgeSection.status).toBe("empty");
    expect(model.userGenderSection.status).toBe("empty");
  });

  it("keeps valid zero metrics distinct from missing KPI data", () => {
    const model = normalizeOverviewData(parseOverviewPayloadSections(emptyOverviewFixture));

    expect(model.kpiSection.status).toBe("valid");
    expect(model.kpiSection.cards[0]).toMatchObject({
      key: "dau",
      status: "valid",
      metric: {
        current: 0,
        previous: 0,
        delta_pct: 0,
      },
    });
    expect(model.hourlyActivity.status).toBe("empty");
  });

  it("maps language distribution labels and percentages for unknown language codes", () => {
    const model = normalizeOverviewData(
      parseOverviewPayloadSections({
        ...overviewFixture,
        user_language_distribution: [
          {
            language: "de",
            users: 2,
          },
          {
            language: "unknown",
            users: 1,
          },
          {
            language: "pt-br",
            users: 1,
          },
        ],
      }),
    );

    expect(model.userLanguageSection.totalUsers).toBe(4);
    expect(model.userLanguageSection.items).toMatchObject([
      {
        key: "de",
        label: "Німецька",
        users: 2,
      },
      {
        key: "unknown",
        label: "Невідомо",
        users: 1,
      },
      {
        key: "pt-br",
        label: "PT-BR",
        users: 1,
      },
    ]);
    expect(model.userLanguageSection.items[0]?.percent).toBe(50);
    expect(model.userLanguageSection.items[1]?.percent).toBe(25);
  });

  it("marks the KPI section as partial when only some cards are missing", () => {
    const { dau: _dau, ...kpisWithoutDau } = overviewFixture.kpis;
    const payload = parseOverviewPayloadSections({
      ...overviewFixture,
      kpis: kpisWithoutDau,
    });
    const model = normalizeOverviewData(payload);

    expect(model.kpiSection.status).toBe("partial");
    expect(model.kpiSection.cards.find((card) => card.key === "dau")).toMatchObject({
      status: "invalid",
      metric: null,
    });
    expect(model.kpiSection.cards.find((card) => card.key === "wau")).toMatchObject({
      status: "valid",
    });
  });

  it("uses available hourly points without pretending missing buckets are zero", () => {
    const payload = parseOverviewPayloadSections({
      ...overviewFixture,
      hourly_activity_series: overviewFixture.hourly_activity_series.filter(
        (item) => item.active_users > 0,
      ),
    });
    const model = normalizeOverviewData(payload);

    expect(model.hourlyActivity.status).toBe("partial");
    expect(model.hourlyActivity.pointCount).toBe(3);
    expect(model.hourlyActivity.missingHours).toHaveLength(21);
    expect(model.hourlyActivity.averageUsersPerHourBucket).toBeCloseTo(5 / 3, 5);
    expect(model.hourlyActivity.peakWindow).toMatchObject({
      hour: 10,
      active_users: 2,
    });
  });

  it("normalizes unordered funnel payloads into the known milestone order", () => {
    const payload = parseOverviewPayloadSections({
      ...overviewFixture,
      funnel: [
        overviewFixture.funnel[3],
        overviewFixture.funnel[1],
        overviewFixture.funnel[0],
        overviewFixture.funnel[2],
      ],
    });
    const model = normalizeOverviewData(payload);

    expect(model.funnelSection.items.map((item) => item.step)).toEqual([
      "Start",
      "First Quiz",
      "Streak 3+",
      "Purchase",
    ]);
    expect(model.funnelSection.items[1]?.ratio_to_previous).toBe(50);
    expect(model.funnelSection.items[3]?.ratio_to_previous).toBe(100);
  });
});
