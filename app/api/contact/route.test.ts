import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactRequest } from "@/lib/contact/contact-schema";
import { handleContactSubmission } from "@/lib/server/contact-submission";

import { POST } from "./route";
import { syntheticContactContext } from "@/lib/analytics/fixtures.test-support";

vi.mock("@/lib/server/contact-submission", () => ({
  handleContactSubmission: vi.fn(),
}));

const handleContactSubmissionMock = vi.mocked(handleContactSubmission);
const CONTACT_REQUEST_MAX_BYTES = 32 * 1024;

const studentPayload = {
  type: "student",
  name: "Anna Test",
  ageGroup: "16_25",
  level: "B1",
  goals: ["alltag", "pruefung"],
  format: "individual",
  timeSlots: ["evening"],
  frequency: "twice",
  budget: "50_100",
  contact: "anna.private@example.com",
  message: "Private student message",
  company: "",
} satisfies ContactRequest;

const partnerPayload = {
  type: "partner",
  name: "Learn Academy",
  partnerType: "school",
  country: "Deutschland",
  studentCount: "50_200",
  offerings: ["teaching", "content"],
  contact: "private-partner@example.com",
  website: "https://partner.example",
  idea: "Private partnership idea",
  startTimeline: "month",
  company: "",
} satisfies ContactRequest;

function contactRequest(
  body: BodyInit | null,
  headers: HeadersInit = {},
  url = "https://site.example/api/contact",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "site.example",
      Origin: "https://site.example",
      ...headers,
    },
    body,
  });
}

async function expectJson(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual(body);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/contact", () => {
  it.each(["student", "partner"] as const)("separates the %s analytics context from the validated contact", async form => {
    const payload = form === "student" ? studentPayload : partnerPayload;
    const analytics = syntheticContactContext(form);
    await expectJson(await POST(contactRequest(JSON.stringify({ ...payload, analytics }))), 202, { ok: true });
    expect(handleContactSubmissionMock).toHaveBeenCalledWith(payload, analytics);
  });
  it.each([null, "private text", { consent: "denied" }, { ...syntheticContactContext(), email: "private@example.test" }, { ...syntheticContactContext(), visitor_id: "invalid" }, syntheticContactContext("partner")])("ignores invalid analytics without rejecting a valid contact: %j", async analytics => {
    await expectJson(await POST(contactRequest(JSON.stringify({ ...studentPayload, analytics }))), 202, { ok: true });
    expect(handleContactSubmissionMock).toHaveBeenCalledExactlyOnceWith(studentPayload);
  });
  it("honeypot bypasses persistence and success even with a valid context", async () => {
    await expectJson(await POST(contactRequest(JSON.stringify({ ...studentPayload, company: "bot", analytics: syntheticContactContext() }))), 202, { ok: true });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });
  it("accepts a valid student request through the server boundary", async () => {
    const response = await POST(contactRequest(JSON.stringify(studentPayload)));

    await expectJson(response, 202, { ok: true });
    expect(handleContactSubmissionMock).toHaveBeenCalledOnce();
    expect(handleContactSubmissionMock).toHaveBeenCalledWith(studentPayload);
  });

  it("accepts a valid partner request through the server boundary", async () => {
    const response = await POST(contactRequest(JSON.stringify(partnerPayload)));

    await expectJson(response, 202, { ok: true });
    expect(handleContactSubmissionMock).toHaveBeenCalledOnce();
    expect(handleContactSubmissionMock).toHaveBeenCalledWith(partnerPayload);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(contactRequest('{"type":"student"'));

    await expectJson(response, 400, { error: "invalid_json" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 422 for an invalid enum", async () => {
    const response = await POST(
      contactRequest(JSON.stringify({ ...studentPayload, level: "INVALID" })),
    );

    await expectJson(response, 422, { error: "invalid_payload" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns 422 when a required field is missing", async () => {
    const { contact: _contact, ...withoutContact } = partnerPayload;
    const response = await POST(contactRequest(JSON.stringify(withoutContact)));

    await expectJson(response, 422, { error: "invalid_payload" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("returns the normal success contract for honeypot submissions without processing them", async () => {
    const response = await POST(
      contactRequest(JSON.stringify({ ...studentPayload, company: "Bot Company" })),
    );

    await expectJson(response, 202, { ok: true });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized body", async () => {
    const response = await POST(
      contactRequest("{}", { "Content-Length": String(CONTACT_REQUEST_MAX_BYTES + 1) }),
    );

    await expectJson(response, 413, { error: "payload_too_large" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body even when Content-Length is absent", async () => {
    const oversized = JSON.stringify({ value: "x".repeat(CONTACT_REQUEST_MAX_BYTES) });
    const request = contactRequest(oversized);
    request.headers.delete("content-length");

    const response = await POST(request);

    await expectJson(response, 413, { error: "payload_too_large" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request", async () => {
    const response = await POST(
      contactRequest(JSON.stringify(studentPayload), { Origin: "https://evil.example" }),
    );

    await expectJson(response, 403, { error: "forbidden" });
    expect(handleContactSubmissionMock).not.toHaveBeenCalled();
  });

  it("accepts a normal same-origin request using the request URL when Host is unavailable", async () => {
    const request = contactRequest(JSON.stringify(studentPayload));
    request.headers.delete("host");

    const response = await POST(request);

    await expectJson(response, 202, { ok: true });
    expect(handleContactSubmissionMock).toHaveBeenCalledWith(studentPayload);
  });

  it("does not expose PII, schema internals, or boundary errors", async () => {
    const invalidResponse = await POST(
      contactRequest(JSON.stringify({ ...partnerPayload, startTimeline: "secret-invalid-value" })),
    );
    const invalidBody = JSON.stringify(await invalidResponse.json());

    expect(invalidResponse.status).toBe(422);
    expect(invalidBody).not.toContain(partnerPayload.contact);
    expect(invalidBody).not.toContain(partnerPayload.idea);
    expect(invalidBody).not.toContain("secret-invalid-value");
    expect(invalidBody).not.toContain("Zod");

    handleContactSubmissionMock.mockRejectedValueOnce(
      new Error(`internal failure for ${studentPayload.contact}: ${studentPayload.message}`),
    );
    const failedResponse = await POST(contactRequest(JSON.stringify(studentPayload)));
    const failedBody = JSON.stringify(await failedResponse.json());

    expect(failedResponse.status).toBe(500);
    expect(failedBody).toBe(JSON.stringify({ error: "contact_submission_failed" }));
    expect(failedBody).not.toContain(studentPayload.contact);
    expect(failedBody).not.toContain(studentPayload.message);
    expect(failedBody).not.toContain("internal failure");
  });
});
