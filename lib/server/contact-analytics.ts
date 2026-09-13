import "server-only";
import { randomUUID } from "node:crypto";
import { contactAnalyticsContextSchema, type ContactAnalyticsContext } from "@/lib/analytics/contract";
import { sendAnalyticsEvents } from "./analytics-service-client";

// Call only after the contact transaction commits. No contact data or record ID enters this function.
export async function sendContactSuccess(context: ContactAnalyticsContext): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { consent: _consent, schema_version, visitor_id, session_id, page_view_id, path, form_id, form_instance_id, submission_attempt_id, ...traffic } = contactAnalyticsContextSchema.parse(context);
    const delivery = sendAnalyticsEvents([{
      product_id: "deutschmit", schema_version, event_id: randomUUID(),
      visitor_id, session_id, page_view_id, path, sequence: null, occurred_at: new Date().toISOString(),
      event_name: "form_success", metadata: { ...traffic, form_id, form_instance_id, submission_attempt_id, conversion_id: randomUUID() },
    }], "server");
    // The fetch also aborts at 500 ms, including response-body reads. This bounds the caller even if an adapter stalls.
    await Promise.race([delivery, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("delivery_timeout")), 500); })]);
  } catch {
    console.warn("analytics_contact_delivery_failed");
  } finally { clearTimeout(timer); }
}
