import { z } from "zod";
import { EVENT_NAMES } from "./contract";
export const reportLabel = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const dimension = z.string().min(1).max(253).nullable();
export const trafficDimensions = {
  referrer_host: dimension, utm_source: dimension, utm_medium: dimension, utm_campaign: dimension,
};
export const reportSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), path: z.string().min(1).max(2048) }).strict(),
  z.object({ kind: z.literal("event"), event_name: z.enum(EVENT_NAMES) }).strict(),
  z.object({ kind: z.literal("element"), element_id: reportLabel, placement: reportLabel }).strict(),
  z.object({ kind: z.literal("error"), error_code: reportLabel, component_id: reportLabel }).strict(),
  z.object({ kind: z.literal("traffic"), ...trafficDimensions }).strict(),
  z.object({ kind: z.literal("form"), form_id: z.enum(["student", "partner"]), event_name: z.enum(["form_open", "form_submit", "form_success", "form_error"]) }).strict(),
  z.object({ kind: z.literal("quiz"), quiz_id: reportLabel, event_name: z.enum(["quiz_started", "quiz_completed"]) }).strict(),
  z.object({ kind: z.literal("intent"), destination: z.enum(["telegram", "youtube", "amazon", "download", "other"]) }).strict(),
]);
export type ReportSelection = z.infer<typeof reportSelectionSchema>;
export function parseReportSelection(value: string | null): ReportSelection | undefined | false {
  if (value === null) return undefined;
  if (value.length > 2048) return false;
  try { const result = reportSelectionSchema.safeParse(JSON.parse(value)); return result.success ? result.data : false; }
  catch { return false; }
}
