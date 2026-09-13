import { z, type ZodIssue } from "zod";

import type { StatsPayload } from "@/app/(public)/public-home-types";
import {
  FEATURE_USAGE_DEFINITIONS,
  FUNNEL_STEP_ORDER,
  KPI_DEFINITIONS,
  OVERVIEW_PERIODS,
} from "@/app/(admin)/admin/(secure)/quiz-arena/dashboard/dashboard-config";
import type {
  AlertItem,
  FunnelItem,
  HourlyActivityItem,
  KpiMetric,
  OverviewData,
  RevenueSeriesItem,
  TopProductItem,
  UserDistributionItem,
  UserLanguageDistributionItem,
  UsersSeriesItem,
} from "@/app/(admin)/admin/(secure)/quiz-arena/dashboard/dashboard-types";

type OverviewMetricRecord = Partial<Record<string, KpiMetric>>;
type OverviewSectionValidationStatus = "valid" | "partial" | "invalid";

export type OverviewSectionResult<T> = {
  status: OverviewSectionValidationStatus;
  data: T | null;
  error: StatisticsPayloadError | null;
};

export type OverviewPayloadSections = {
  period: OverviewData["period"];
  generated_at: string;
  kpis: OverviewSectionResult<OverviewMetricRecord>;
  revenue_series: OverviewSectionResult<RevenueSeriesItem[]>;
  users_series: OverviewSectionResult<UsersSeriesItem[]>;
  hourly_activity_series: OverviewSectionResult<HourlyActivityItem[]>;
  funnel: OverviewSectionResult<FunnelItem[]>;
  top_products: OverviewSectionResult<TopProductItem[]>;
  user_language_distribution: OverviewSectionResult<UserLanguageDistributionItem[]>;
  user_age_distribution: OverviewSectionResult<UserDistributionItem[]>;
  user_gender_distribution: OverviewSectionResult<UserDistributionItem[]>;
  feature_usage: OverviewSectionResult<OverviewMetricRecord>;
  alerts: OverviewSectionResult<AlertItem[]>;
};

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const overviewEnvelopeSchema = z
  .object({
    period: z.enum(OVERVIEW_PERIODS),
    generated_at: isoDateTimeSchema,
  })
  .passthrough();

const kpiMetricSchema = z
  .object({
    current: nonNegativeNumberSchema,
    previous: nonNegativeNumberSchema,
    delta_pct: z.number().finite(),
  })
  .passthrough();

const revenueSeriesItemSchema = z
  .object({
    date: isoDateSchema,
    stars: nonNegativeIntegerSchema,
    eur: nonNegativeNumberSchema,
  })
  .passthrough();

const usersSeriesItemSchema = z
  .object({
    date: isoDateSchema,
    new_users: nonNegativeIntegerSchema,
    active_users: nonNegativeIntegerSchema,
  })
  .passthrough();

const hourlyActivityItemSchema = z
  .object({
    hour: z.number().int().min(0).max(23),
    active_users: nonNegativeIntegerSchema,
  })
  .passthrough();

const funnelItemSchema = z
  .object({
    step: z.enum(FUNNEL_STEP_ORDER),
    value: nonNegativeIntegerSchema,
  })
  .passthrough();

const topProductSchema = z
  .object({
    product: z.string().min(1),
    revenue_stars: nonNegativeIntegerSchema,
  })
  .passthrough();

const userLanguageDistributionItemSchema = z
  .object({
    language: z.string().min(1),
    users: nonNegativeIntegerSchema,
  })
  .passthrough();

const userDistributionItemSchema = z
  .object({
    group: z.string().min(1),
    users: nonNegativeIntegerSchema,
  })
  .passthrough();

const alertSchema = z
  .object({
    type: z.string().min(1),
    severity: z.string().min(1),
    count: nonNegativeIntegerSchema.optional(),
    from: nonNegativeNumberSchema.optional(),
    to: nonNegativeNumberSchema.optional(),
    invalid_promo_attempts_1h: nonNegativeIntegerSchema.optional(),
  })
  .passthrough();

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

function createCustomIssue(message: string, path: (string | number)[] = []): ZodIssue {
  return {
    code: z.ZodIssueCode.custom,
    message,
    path,
  };
}

function prefixIssues(issues: ZodIssue[], pathPrefix: (string | number)[]): ZodIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: [...pathPrefix, ...issue.path],
  }));
}

function createSectionError(sectionKey: string, issues: ZodIssue[]): StatisticsPayloadError {
  return new StatisticsPayloadError(`/admin/overview.${sectionKey}`, issues);
}

function createInvalidSectionResult<T>(
  sectionKey: string,
  issues: ZodIssue[],
): OverviewSectionResult<T> {
  return {
    status: "invalid",
    data: null,
    error: createSectionError(sectionKey, issues),
  };
}

function createPartialSectionResult<T>(
  sectionKey: string,
  data: T,
  issues: ZodIssue[],
): OverviewSectionResult<T> {
  return {
    status: "partial",
    data,
    error: createSectionError(sectionKey, issues),
  };
}

function createValidSectionResult<T>(data: T): OverviewSectionResult<T> {
  return {
    status: "valid",
    data,
    error: null,
  };
}

function parseMetricSection(
  sectionKey: "kpis" | "feature_usage",
  sectionValue: unknown,
  expectedKeys: readonly string[],
): OverviewSectionResult<OverviewMetricRecord> {
  const recordResult = z.record(z.string(), z.unknown()).safeParse(sectionValue);
  if (!recordResult.success) {
    return createInvalidSectionResult(sectionKey, recordResult.error.issues);
  }

  const metrics: OverviewMetricRecord = {};
  const issues: ZodIssue[] = [];

  for (const key of expectedKeys) {
    const metricResult = kpiMetricSchema.safeParse(recordResult.data[key]);
    if (metricResult.success) {
      const { current, previous, delta_pct } = metricResult.data;
      const expectedDelta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      const definition = [...KPI_DEFINITIONS, ...FEATURE_USAGE_DEFINITIONS].find((item) => item.key === key);
      if (Math.abs(delta_pct - expectedDelta) > 0.011 || (definition?.unit === "count" && (!Number.isInteger(current) || !Number.isInteger(previous)))) {
        issues.push(createCustomIssue("Invalid metric arithmetic", [key]));
        continue;
      }
      metrics[key] = metricResult.data;
      continue;
    }
    issues.push(...prefixIssues(metricResult.error.issues, [key]));
  }

  if (issues.length === 0) {
    return createValidSectionResult(metrics);
  }

  if (Object.keys(metrics).length > 0) {
    return createPartialSectionResult(sectionKey, metrics, issues);
  }

  return createInvalidSectionResult(sectionKey, issues);
}

function parseArraySection<T>(
  sectionKey: string,
  sectionValue: unknown,
  schema: z.ZodType<T>,
): OverviewSectionResult<T> {
  const result = schema.safeParse(sectionValue);
  if (!result.success) {
    return createInvalidSectionResult(sectionKey, result.error.issues);
  }
  if (Array.isArray(result.data)) {
    const key = ({ revenue_series: "date", users_series: "date", top_products: "product", user_language_distribution: "language", user_age_distribution: "group", user_gender_distribution: "group" } as Record<string, string>)[sectionKey];
    if (key) {
      const values = result.data.map((row) => String(row[key]).trim().toLowerCase());
      if (new Set(values).size !== values.length) return createInvalidSectionResult(sectionKey, [createCustomIssue("Duplicate bucket")]);
    }
  }
  return createValidSectionResult(result.data);
}

function parseOptionalArraySection<T>(
  sectionKey: string,
  sectionValue: unknown,
  schema: z.ZodType<T>,
  _fallbackData: T,
): OverviewSectionResult<T> {
  if (sectionValue === undefined || sectionValue === null) {
    return createInvalidSectionResult(sectionKey, [createCustomIssue("Missing section")]);
  }
  return parseArraySection(sectionKey, sectionValue, schema);
}

function parseHourlyActivitySection(sectionValue: unknown): OverviewSectionResult<HourlyActivityItem[]> {
  const result = z.array(hourlyActivityItemSchema).max(24).safeParse(sectionValue);
  if (!result.success) {
    return createInvalidSectionResult("hourly_activity_series", result.error.issues);
  }

  const seenHours = new Set<number>();
  const issues: ZodIssue[] = [];

  for (const [index, item] of result.data.entries()) {
    if (seenHours.has(item.hour)) {
      issues.push(createCustomIssue(`Duplicate hourly bucket ${item.hour}`, [index, "hour"]));
      continue;
    }
    seenHours.add(item.hour);
  }

  if (issues.length > 0) {
    return createInvalidSectionResult("hourly_activity_series", issues);
  }

  const sortedSeries = [...result.data].sort((left, right) => left.hour - right.hour);
  const missingHours = Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => !seenHours.has(hour),
  );

  if (missingHours.length > 0) {
    return createPartialSectionResult(
      "hourly_activity_series",
      sortedSeries,
      missingHours.map((hour) =>
        createCustomIssue(`Missing hourly bucket ${hour}`, [hour]),
      ),
    );
  }

  return createValidSectionResult(sortedSeries);
}

function parseFunnelSection(sectionValue: unknown): OverviewSectionResult<FunnelItem[]> {
  const result = z.array(funnelItemSchema).max(FUNNEL_STEP_ORDER.length).safeParse(sectionValue);
  if (!result.success) {
    return createInvalidSectionResult("funnel", result.error.issues);
  }

  const seenSteps = new Set<string>();
  const issues: ZodIssue[] = [];

  for (const [index, item] of result.data.entries()) {
    if (seenSteps.has(item.step)) {
      issues.push(createCustomIssue(`Duplicate funnel step ${item.step}`, [index, "step"]));
      continue;
    }
    seenSteps.add(item.step);
  }

  if (issues.length > 0) {
    return createInvalidSectionResult("funnel", issues);
  }

  const orderedData = [...result.data].sort(
    (left, right) =>
      FUNNEL_STEP_ORDER.indexOf(left.step as (typeof FUNNEL_STEP_ORDER)[number]) -
      FUNNEL_STEP_ORDER.indexOf(right.step as (typeof FUNNEL_STEP_ORDER)[number]),
  );
  const missingSteps = FUNNEL_STEP_ORDER.filter((step) => !seenSteps.has(step));

  if (missingSteps.length > 0) {
    return createPartialSectionResult(
      "funnel",
      orderedData,
      missingSteps.map((step) => createCustomIssue(`Missing funnel step ${step}`, [step])),
    );
  }

  return createValidSectionResult(orderedData);
}

function requireValidSection<T>(result: OverviewSectionResult<T>): T {
  if (result.status !== "valid" || result.data === null) {
    throw result.error ?? new Error("Overview section is not fully valid");
  }
  return result.data;
}

export function parsePublicStatsPayload(payload: unknown): StatsPayload {
  const result = publicStatsSchema.safeParse(payload);
  if (!result.success) {
    throw new StatisticsPayloadError("/stats", result.error.issues);
  }
  return result.data as StatsPayload;
}

export function parseOverviewPayloadSections(payload: unknown): OverviewPayloadSections {
  const envelope = overviewEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new StatisticsPayloadError("/admin/overview", envelope.error.issues);
  }

  const rawPayload = envelope.data as Record<string, unknown>;

  return {
    period: envelope.data.period,
    generated_at: envelope.data.generated_at,
    kpis: parseMetricSection(
      "kpis",
      rawPayload.kpis,
      KPI_DEFINITIONS.map((definition) => definition.key),
    ),
    revenue_series: parseArraySection(
      "revenue_series",
      rawPayload.revenue_series,
      z.array(revenueSeriesItemSchema),
    ),
    users_series: parseArraySection(
      "users_series",
      rawPayload.users_series,
      z.array(usersSeriesItemSchema),
    ),
    hourly_activity_series: parseHourlyActivitySection(rawPayload.hourly_activity_series),
    funnel: parseFunnelSection(rawPayload.funnel),
    top_products: parseArraySection(
      "top_products",
      rawPayload.top_products,
      z.array(topProductSchema).max(5),
    ),
    user_language_distribution: parseOptionalArraySection(
      "user_language_distribution",
      rawPayload.user_language_distribution,
      z.array(userLanguageDistributionItemSchema).max(32),
      [],
    ),
    user_age_distribution: parseOptionalArraySection(
      "user_age_distribution",
      rawPayload.user_age_distribution,
      z.array(userDistributionItemSchema).max(16),
      [],
    ),
    user_gender_distribution: parseOptionalArraySection(
      "user_gender_distribution",
      rawPayload.user_gender_distribution,
      z.array(userDistributionItemSchema).max(16),
      [],
    ),
    feature_usage: parseMetricSection(
      "feature_usage",
      rawPayload.feature_usage,
      FEATURE_USAGE_DEFINITIONS.map((definition) => definition.key),
    ),
    alerts: parseArraySection("alerts", rawPayload.alerts, z.array(alertSchema)),
  };
}

export function parseOverviewPayload(payload: unknown): OverviewData {
  const sections = parseOverviewPayloadSections(payload);

  return {
    period: sections.period,
    generated_at: sections.generated_at,
    kpis: requireValidSection(sections.kpis) as Record<string, KpiMetric>,
    revenue_series: requireValidSection(sections.revenue_series),
    users_series: requireValidSection(sections.users_series),
    hourly_activity_series: requireValidSection(sections.hourly_activity_series),
    funnel: requireValidSection(sections.funnel),
    top_products: requireValidSection(sections.top_products),
    user_language_distribution: requireValidSection(sections.user_language_distribution),
    user_age_distribution: requireValidSection(sections.user_age_distribution),
    user_gender_distribution: requireValidSection(sections.user_gender_distribution),
    feature_usage: requireValidSection(sections.feature_usage) as Record<string, KpiMetric>,
    alerts: requireValidSection(sections.alerts),
  };
}
