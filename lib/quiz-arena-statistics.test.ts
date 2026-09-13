import { describe, expect, it } from "vitest";

import emptyOverviewFixture from "@/docs/statistics-fixtures/admin-overview-empty-7d.json";
import overviewFixture from "@/docs/statistics-fixtures/admin-overview-seeded-7d.json";
import publicStatsFixture from "@/docs/statistics-fixtures/public-stats-seeded.json";

import {
  parseOverviewPayload,
  parseOverviewPayloadSections,
  parsePublicStatsPayload,
  StatisticsPayloadError,
} from "./quiz-arena-statistics";

describe("statistics payload parsing", () => {
  it("accepts the seeded public stats fixture", () => {
    expect(parsePublicStatsPayload(publicStatsFixture)).toEqual(publicStatsFixture);
  });

  it("rejects invalid public stats values", () => {
    expect(() =>
      parsePublicStatsPayload({
        users: "1",
        quizzes: 1,
      }),
    ).toThrow(StatisticsPayloadError);
  });

  it("accepts the seeded overview fixture", () => {
    expect(parseOverviewPayload(overviewFixture)).toEqual(overviewFixture);
  });

  it("accepts optional user distribution sections from overview payloads", () => {
    const parsed = parseOverviewPayloadSections({
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
      ],
    });

    expect(parsed.user_language_distribution.status).toBe("valid");
    expect(parsed.user_language_distribution.data).toEqual([
      {
        language: "de",
        users: 2,
      },
      {
        language: "unknown",
        users: 1,
      },
    ]);
    expect(parsed.user_age_distribution.data).toEqual([]);
    expect(parsed.user_gender_distribution.data).toEqual([]);
  });

  it("rejects invalid user language distribution counts", () => {
    const parsed = parseOverviewPayloadSections({
      ...overviewFixture,
      user_language_distribution: [
        {
          language: "de",
          users: -1,
        },
      ],
    });

    expect(parsed.user_language_distribution.status).toBe("invalid");
    expect(parsed.user_language_distribution.error).toBeInstanceOf(StatisticsPayloadError);
  });

  it("accepts the empty overview fixture with 24 hourly buckets", () => {
    const parsed = parseOverviewPayload(emptyOverviewFixture);
    expect(parsed.hourly_activity_series).toHaveLength(24);
    expect(parsed.funnel).toHaveLength(4);
  });

  it("returns a partial KPI section when one metric is missing", () => {
    const { dau: _dau, ...kpisWithoutDau } = overviewFixture.kpis;
    const parsed = parseOverviewPayloadSections({
      ...overviewFixture,
      kpis: kpisWithoutDau,
    });

    expect(parsed.kpis.status).toBe("partial");
    expect(parsed.kpis.data).toMatchObject({
      wau: overviewFixture.kpis.wau,
    });
    expect(parsed.kpis.error).toBeInstanceOf(StatisticsPayloadError);
  });

  it("returns a partial hourly section when bucket coverage is incomplete", () => {
    const parsed = parseOverviewPayloadSections({
      ...overviewFixture,
      hourly_activity_series: overviewFixture.hourly_activity_series.filter(
        (item) => item.active_users > 0,
      ),
    });

    expect(parsed.hourly_activity_series.status).toBe("partial");
    expect(parsed.hourly_activity_series.data).toHaveLength(3);
    expect(parsed.hourly_activity_series.error).toBeInstanceOf(StatisticsPayloadError);
  });

  it("rejects incomplete overview payloads in strict mode", () => {
    const { dau: _dau, ...kpisWithoutDau } = overviewFixture.kpis;

    expect(() =>
      parseOverviewPayload({
        ...overviewFixture,
        kpis: kpisWithoutDau,
      }),
    ).toThrow(StatisticsPayloadError);
  });

  it("accepts unordered funnel steps and normalizes them to backend order", () => {
    const parsed = parseOverviewPayload({
      ...overviewFixture,
      funnel: [
        overviewFixture.funnel[3],
        overviewFixture.funnel[1],
        overviewFixture.funnel[0],
        overviewFixture.funnel[2],
      ],
    });

    expect(parsed.funnel.map((item) => item.step)).toEqual([
      "Start",
      "First Quiz",
      "Streak 3+",
      "Purchase",
    ]);
  });
});
