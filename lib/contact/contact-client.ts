import type { ContactRequest } from "./contact-schema";

export const CONTACT_ENDPOINT = "/api/contact";

export class ContactRequestError extends Error {
  constructor(public code: "validation_error" | "network_error" | "server_error" | "rate_limited") { super("Contact request failed"); }
}

export async function submitContactRequest(payload: ContactRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch { throw new ContactRequestError("network_error"); }

  if (!response.ok) {
    throw new ContactRequestError(response.status === 429 ? "rate_limited" : [400, 422].includes(response.status) ? "validation_error" : "server_error");
  }
}
