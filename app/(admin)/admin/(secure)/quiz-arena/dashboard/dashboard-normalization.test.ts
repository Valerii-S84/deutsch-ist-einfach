import { describe, expect, it } from "vitest";

import emptyOverviewFixture from "@/docs/statistics-fixtures/admin-overview-empty-7d.json";
import overviewFixture from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
import { parseOverviewPayloadSections } from "@/lib/quiz-arena-statistics";

import { FEATURE_USAGE_DEFINITIONS, KPI_DEFINITIONS } from "./dashboard-config";
import { normalizeOverviewData } from "./dashboard-normalization";
import type { OverviewPayloadSections, OverviewSectionResult } from "@/lib/quiz-arena-statistics";

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

  it("marks invalid source sections without inventing fallback chart values", () => {
    const invalid = <T,>(): OverviewSectionResult<T> => ({ status: "invalid", data: null, error: null });
    const sections: OverviewPayloadSections = {
      period: "7d",
      generated_at: "2026-09-14T12:00:00Z",
      kpis: invalid(),
      revenue_series: invalid(),
      users_series: invalid(),
      hourly_activity_series: invalid(),
      funnel: invalid(),
      top_products: invalid(),
      user_language_distribution: invalid(),
      user_age_distribution: invalid(),
      user_gender_distribution: invalid(),
      feature_usage: invalid(),
      alerts: invalid(),
    };

    const model = normalizeOverviewData(sections);
    expect(model.kpiSection.status).toBe("invalid");
    expect(model.featureUsageSection.status).toBe("invalid");
    expect(model.hourlyActivity).toMatchObject({ status: "invalid", pointCount: 0, peakWindow: null, averageUsersPerHourBucket: null });
    expect(model.hourlyActivity.missingHours).toHaveLength(24);
    expect(model.revenueSection).toMatchObject({ status: "invalid", totalRevenueStars: null, series: [] });
    expect(model.usersSection).toMatchObject({ status: "invalid", averageActiveUsersPerDay: null, series: [] });
    expect(model.userLanguageSection).toMatchObject({ status: "invalid", totalUsers: 0, items: [] });
    expect(model.funnelSection).toMatchObject({ status: "invalid", items: [] });
    expect(model.topProductsSection).toMatchObject({ status: "invalid", items: [] });
    expect(model.alertsSection).toMatchObject({ status: "invalid", alerts: [] });
  });

  it("keeps valid empty sections explicit and calculates zero-safe funnel ratios", () => {
    const valid = <T,>(data: T): OverviewSectionResult<T> => ({ status: "valid", data, error: null });
    const metric = { current: 0, previous: 0, delta_pct: 0 };
    const sections = parseOverviewPayloadSections({
      ...emptyOverviewFixture,
      kpis: Object.fromEntries(KPI_DEFINITIONS.map(definition => [definition.key, metric])),
      feature_usage: Object.fromEntries(FEATURE_USAGE_DEFINITIONS.map(definition => [definition.key, metric])),
      hourly_activity_series: Array.from({ length: 24 }, (_, hour) => ({ hour, active_users: 0 })),
      funnel: [
        { step: "Start", value: 0 },
        { step: "First Quiz", value: 1 },
        { step: "Streak 3+", value: 0 },
        { step: "Purchase", value: 0 },
      ],
      revenue_series: [],
      users_series: [],
      top_products: [],
      alerts: [],
      user_language_distribution: [],
      user_age_distribution: [{ group: "18-24", users: 0 }],
      user_gender_distribution: [{ group: "unknown", users: 0 }],
    });
    sections.funnel = valid(sections.funnel.data!);

    const model = normalizeOverviewData(sections);
    expect(model.hourlyActivity).toMatchObject({ status: "empty", averageUsersPerHourBucket: 0, topWindows: [] });
    expect(model.revenueSection).toMatchObject({ status: "empty", totalRevenueStars: 0 });
    expect(model.usersSection).toMatchObject({ status: "empty", averageActiveUsersPerDay: 0 });
    expect(model.userLanguageSection.status).toBe("empty");
    expect(model.userAgeSection).toMatchObject({ status: "empty", totalUsers: 0 });
    expect(model.funnelSection.status).toBe("valid");
    expect(model.funnelSection.items[1]?.ratio_to_previous).toBeNull();
    expect(model.topProductsSection.status).toBe("empty");
    expect(model.alertsSection.status).toBe("empty");
  });
});
