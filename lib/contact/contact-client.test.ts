import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTACT_ENDPOINT, submitContactRequest } from "./contact-client";
import type { StudentContactRequest } from "./contact-schema";

const studentPayload: StudentContactRequest = {
  type: "student",
  name: "Anna Test",
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
  vi.restoreAllMocks();
});

describe("contact client", () => {
  it("sends only the payload without reading browser storage", async () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("storage must not be read"); });
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", send);
    await submitContactRequest(studentPayload);
    const body = JSON.parse(send.mock.calls[0][1]!.body as string);
    expect(body).toEqual(studentPayload);
    expect(body).not.toHaveProperty("analytics");
    expect(read).not.toHaveBeenCalled();
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
