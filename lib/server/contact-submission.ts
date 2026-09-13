import type {
  ContactRequest,
  PartnerContactRequest,
  StudentContactRequest,
} from "@/lib/contact/contact-schema";
import {
  saveContactRequest,
  type PersistedContactPayload,
} from "@/lib/server/contact-store";
import type { ContactAnalyticsContext } from "@/lib/analytics/contract";
import { sendContactSuccess } from "./contact-analytics";

function withoutHoneypot(payload: ContactRequest): PersistedContactPayload {
  if (payload.type === "student") {
    const { company: _company, ...persistedPayload } = payload satisfies StudentContactRequest;
    return persistedPayload;
  }

  const { company: _company, ...persistedPayload } = payload satisfies PartnerContactRequest;
  return persistedPayload;
}

export async function handleContactSubmission(payload: ContactRequest, analytics?: ContactAnalyticsContext): Promise<void> {
  await saveContactRequest(withoutHoneypot(payload));
  if (analytics) await sendContactSuccess(analytics);
}
