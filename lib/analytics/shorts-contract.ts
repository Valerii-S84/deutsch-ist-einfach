import { z } from "zod";

export const shortsPaths = ["/", "/privacy/", "/support/", "/terms/"] as const;
export const shortsElements = ["home", "privacy", "support", "terms", "email", "preview_primary", "preview_secondary", "preview_button"] as const;
export const shortsEventSchema = z.object({
  event_id: z.string().uuid(), visitor_id: z.string().uuid(), session_id: z.string().uuid(), page_view_id: z.string().uuid(),
  event_name: z.enum(["page_view", "element_click", "page_leave"]),
  occurred_at: z.string().datetime(), sequence: z.number().int().min(1).max(1_000_000),
  path: z.enum(shortsPaths), element_id: z.enum(shortsElements).nullable(),
  active_ms: z.number().int().min(0).max(86_400_000).nullable(),
  referrer_host: z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i).nullable(),
  device: z.enum(["mobile", "tablet", "desktop"]), is_test: z.boolean(),
}).strict().superRefine((event, context) => {
  if ((event.event_name === "element_click") !== (event.element_id !== null) || (event.event_name === "page_leave") !== (event.active_ms !== null)) {
    context.addIssue({ code: "custom", message: "invalid_event_fields" });
  }
});
export const shortsBatchSchema = z.object({ events: z.array(shortsEventSchema).min(1).max(20) }).strict();
export type ShortsEvent = z.infer<typeof shortsEventSchema>;
const count = z.number().int().nonnegative();
const stamp = z.string().datetime({ offset: true });
export const shortsReportSchema = z.object({
  product_id: z.literal("shorts-blocker-kids"), days: z.number().int(), page: count,
  generated_at: stamp, history_available_from: stamp.nullable(), last_received_at: stamp.nullable(),
  totals: z.object({ visitors: count, sessions: count, page_views: count, clicks: count }),
  pages: z.array(z.object({ path: z.enum(shortsPaths), views: count, clicks: count })),
  elements: z.array(z.object({ element_id: z.enum(shortsElements), clicks: count })),
  sources: z.array(z.object({ host: z.string().max(253).nullable(), sessions: count })),
  sessions: z.array(z.object({ session_id: z.string().uuid(), visitor_id: z.string().uuid(), first_at: stamp, last_at: stamp, views: count, clicks: count })),
  selected_session: z.string().uuid().nullable(),
  events: z.array(z.object({ event_id: z.string().uuid(), event_name: z.enum(["page_view", "element_click", "page_leave"]), occurred_at: stamp, path: z.enum(shortsPaths), element_id: z.enum(shortsElements).nullable(), active_ms: count.nullable() })),
  events_truncated: z.boolean(),
});
