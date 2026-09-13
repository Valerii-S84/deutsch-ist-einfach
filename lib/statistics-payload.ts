import { z, type ZodIssue } from "zod";

import type { StatsPayload } from "@/app/(public)/public-home-types";

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const publicStatsSchema = z
  .object({
    users: nonNegativeIntegerSchema,
    quizzes: nonNegativeIntegerSchema,
  })
  .passthrough();

export class StatisticsPayloadError extends Error {
  readonly issues: ZodIssue[];
  readonly route: string;

  constructor(route: string, issues: ZodIssue[]) {
    super(`Invalid statistics payload for ${route}`);
    this.name = "StatisticsPayloadError";
    this.route = route;
    this.issues = issues;
  }
}

export function parsePublicStatsPayload(payload: unknown): StatsPayload {
  const result = publicStatsSchema.safeParse(payload);
  if (!result.success) {
    throw new StatisticsPayloadError("/stats", result.error.issues);
  }
  return result.data as StatsPayload;
}
