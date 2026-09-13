import { describe, expect, it } from "vitest";

import publicStatsFixture from "@/docs/statistics-fixtures/public-stats-seeded.json";

import {
  parsePublicStatsPayload,
  StatisticsPayloadError,
} from "./statistics-payload";

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
});
