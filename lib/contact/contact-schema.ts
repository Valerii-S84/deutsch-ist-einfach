import { z } from "zod";
import { contactAnalyticsContextSchema } from "../analytics/contract";

export const STUDENT_AGE_GROUPS = ["unter_16", "16_25", "26_35", "36_50", "50_plus"] as const;
export const STUDENT_LEVELS = ["A1", "A2", "B1", "B2", "C1_C2", "UNSICHER"] as const;
export const STUDENT_GOALS = [
  "alltag",
  "pruefung",
  "karriere",
  "umzug",
  "universitaet",
  "reisen",
  "hobby",
] as const;
export const STUDENT_FORMATS = ["individual", "group", "self", "undecided"] as const;
export const STUDENT_TIME_SLOTS = ["morning", "day", "evening", "weekend"] as const;
export const STUDENT_FREQUENCIES = ["once", "twice", "three_plus", "daily"] as const;
export const STUDENT_BUDGETS = ["bis_50", "50_100", "100_200", "200_plus", "offen"] as const;

export const PARTNER_TYPES = ["tutor", "school", "platform", "creator", "other_org"] as const;
export const PARTNER_STUDENT_COUNTS = ["bis_10", "10_50", "50_200", "200_plus", "start"] as const;
export const PARTNER_OFFERINGS = ["teaching", "ads", "content", "product", "other"] as const;
export const PARTNER_START_TIMELINES = ["asap", "month", "explore"] as const;

export type StudentAgeGroup = (typeof STUDENT_AGE_GROUPS)[number];
export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export type StudentGoal = (typeof STUDENT_GOALS)[number];
export type StudentFormat = (typeof STUDENT_FORMATS)[number];
export type StudentTimeSlot = (typeof STUDENT_TIME_SLOTS)[number];
export type StudentFrequency = (typeof STUDENT_FREQUENCIES)[number];
export type StudentBudget = (typeof STUDENT_BUDGETS)[number];
export type PartnerType = (typeof PARTNER_TYPES)[number];
export type PartnerStudentCount = (typeof PARTNER_STUDENT_COUNTS)[number];
export type PartnerOffering = (typeof PARTNER_OFFERINGS)[number];
export type PartnerStartTimeline = (typeof PARTNER_START_TIMELINES)[number];

export const studentContactRequestSchema = z
  .object({
    type: z.literal("student"),
    name: z.string().min(1),
    ageGroup: z.enum(STUDENT_AGE_GROUPS),
    level: z.enum(STUDENT_LEVELS),
    goals: z.array(z.enum(STUDENT_GOALS)).min(1),
    format: z.enum(STUDENT_FORMATS),
    timeSlots: z.array(z.enum(STUDENT_TIME_SLOTS)).min(1),
    frequency: z.enum(STUDENT_FREQUENCIES),
    budget: z.union([z.literal(""), z.enum(STUDENT_BUDGETS)]),
    contact: z.string().min(1),
    message: z.string(),
    // Anti-bot honeypot. It is intentionally part of the transport contract only.
    company: z.string(),
  })
  .strict();

export const partnerContactRequestSchema = z
  .object({
    type: z.literal("partner"),
    name: z.string().min(1),
    partnerType: z.enum(PARTNER_TYPES),
    country: z.string().min(1),
    studentCount: z.enum(PARTNER_STUDENT_COUNTS),
    offerings: z.array(z.enum(PARTNER_OFFERINGS)).min(1),
    contact: z.string().min(1),
    website: z.string(),
    idea: z.string().min(1),
    startTimeline: z.enum(PARTNER_START_TIMELINES),
    // Anti-bot honeypot. It is intentionally part of the transport contract only.
    company: z.string(),
  })
  .strict();

export const contactRequestSchema = z.discriminatedUnion("type", [
  studentContactRequestSchema,
  partnerContactRequestSchema,
]);

export type StudentContactRequest = z.infer<typeof studentContactRequestSchema>;
export type PartnerContactRequest = z.infer<typeof partnerContactRequestSchema>;
export type ContactRequest = z.infer<typeof contactRequestSchema>;

export function parseContactTransport(value: unknown) {
  const { analytics, ...contact } = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : { invalid: value };
  const validation = contactRequestSchema.safeParse(contact);
  const context = contactAnalyticsContextSchema.safeParse(analytics);
  return { validation, analytics: validation.success && context.success && context.data.form_id === validation.data.type ? context.data : undefined };
}
