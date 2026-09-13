import type { ContactRequest } from "./contact-schema";
import type { ContactAnalyticsContext } from "../analytics/contract";
import { getAnalyticsMode, WEBSITE_CONSENT_STORAGE_KEY } from "../analytics";
import { isCurrentVisitor } from "../analytics/identity";

export const CONTACT_ENDPOINT = "/api/contact";

export class ContactRequestError extends Error {
  constructor(public code: "validation_error" | "network_error" | "server_error" | "rate_limited") { super("Contact request failed"); }
}

export async function submitContactRequest(payload: ContactRequest, analytics?: ContactAnalyticsContext): Promise<void> {
  // Recheck immediately before fetch, including a cross-tab revocation during preparation.
  try {
    if (getAnalyticsMode() !== "new" || localStorage.getItem(WEBSITE_CONSENT_STORAGE_KEY) !== "granted" || !isCurrentVisitor(analytics?.visitor_id ?? null)) analytics = undefined;
  } catch { analytics = undefined; }
  let response: Response;
  try {
    response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analytics ? { ...payload, analytics } : payload),
    });
  } catch { throw new ContactRequestError("network_error"); }

  if (!response.ok) {
    throw new ContactRequestError(response.status === 429 ? "rate_limited" : [400, 422].includes(response.status) ? "validation_error" : "server_error");
  }
}
