import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTACT_ENDPOINT, submitContactRequest } from "./contact-client";
import type { StudentContactRequest } from "./contact-schema";
import { syntheticContactContext } from "@/lib/analytics/fixtures.test-support";
import { WEBSITE_CONSENT_STORAGE_KEY } from "@/lib/analytics";
import { VISITOR_KEY } from "@/lib/analytics/identity";

const studentPayload: StudentContactRequest = {
  type: "student",
  name: "Anna Test",
  ageGroup: "16_25",
  level: "B1",
  goals: ["alltag", "pruefung"],
  format: "individual",
  timeSlots: ["evening"],
  frequency: "twice",
  budget: "50_100",
  contact: "anna@example.com",
  message: "Prüfungsvorbereitung",
  company: "",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs(); localStorage.clear();
});

describe("contact client", () => {
  it.each(["granted", "denied", "pending"])("checks current %s consent immediately before the request", async consent => {
    vi.stubEnv("NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE", "new");
    const context = syntheticContactContext();
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, consent);
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: context.visitor_id, created: Date.now() }));
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 })); vi.stubGlobal("fetch", send);
    await submitContactRequest(studentPayload, context);
    const body = JSON.parse(send.mock.calls[0][1].body);
    expect(body.analytics).toEqual(consent === "granted" ? context : undefined);
    expect(body.contact).toBe(studentPayload.contact);
  });
  it("drops old context after revoke/regrant rotates the visitor", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE", "new");
    localStorage.setItem(WEBSITE_CONSENT_STORAGE_KEY, "granted");
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id: crypto.randomUUID(), created: Date.now() }));
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 })); vi.stubGlobal("fetch", send);
    await submitContactRequest(studentPayload, syntheticContactContext());
    expect(JSON.parse(send.mock.calls[0][1].body)).not.toHaveProperty("analytics");
  });
  it("posts the payload to the fixed same-origin endpoint without credentials", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 202 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await submitContactRequest(studentPayload);

    expect(CONTACT_ENDPOINT).toBe("/api/contact");
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/contact", {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(studentPayload),
    });
  });

  it("rejects a non-success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(submitContactRequest(studentPayload)).rejects.toThrow(
      "Contact request failed",
    );
  });
});
