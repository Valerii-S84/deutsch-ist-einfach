import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContactRequest } from "@/lib/contact/contact-schema";
import { saveContactRequest } from "@/lib/server/contact-store";

import { handleContactSubmission } from "./contact-submission";

vi.mock("@/lib/server/contact-store", () => ({
  saveContactRequest: vi.fn(),
}));

const saveContactRequestMock = vi.mocked(saveContactRequest);

const studentPayload = {
  type: "student",
  name: "Anna Test",
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

afterEach(() => {
  vi.clearAllMocks();
});

describe("contact submission boundary", () => {
  it("waits for persistence and stores no analytics context", async () => {
    let commit!: () => void;
    saveContactRequestMock.mockImplementationOnce(() => new Promise(resolve => { commit = () => resolve({} as Awaited<ReturnType<typeof saveContactRequest>>); }));
    let completed = false;
    const pending = handleContactSubmission(studentPayload).then(() => { completed = true; });
    expect(completed).toBe(false);
    commit();
    await pending;
    expect(completed).toBe(true);
    expect(saveContactRequestMock.mock.calls[0][0]).not.toHaveProperty("analytics");
    expect(saveContactRequestMock.mock.calls[0][0]).not.toHaveProperty("visitor_id");
  });
  it("propagates a failed contact commit", async () => {
    saveContactRequestMock.mockRejectedValueOnce(new Error("synthetic DB failure"));
    await expect(handleContactSubmission(studentPayload)).rejects.toThrow();
  });
  it("persists the complete student payload without its honeypot", async () => {
    await handleContactSubmission(studentPayload);

    expect(saveContactRequestMock).toHaveBeenCalledOnce();
    expect(saveContactRequestMock).toHaveBeenCalledWith({
      type: "student",
      name: studentPayload.name,
      level: studentPayload.level,
      goals: studentPayload.goals,
      format: studentPayload.format,
      timeSlots: studentPayload.timeSlots,
      frequency: studentPayload.frequency,
      budget: studentPayload.budget,
      contact: studentPayload.contact,
      message: studentPayload.message,
    });
  });

  it("persists the complete partner payload without its honeypot", async () => {
    await handleContactSubmission(partnerPayload);

    expect(saveContactRequestMock).toHaveBeenCalledOnce();
    expect(saveContactRequestMock).toHaveBeenCalledWith({
      type: "partner",
      name: partnerPayload.name,
      partnerType: partnerPayload.partnerType,
      country: partnerPayload.country,
      studentCount: partnerPayload.studentCount,
      offerings: partnerPayload.offerings,
      contact: partnerPayload.contact,
      website: partnerPayload.website,
      idea: partnerPayload.idea,
      startTimeline: partnerPayload.startTimeline,
    });
  });

  it("propagates storage failure to the route boundary", async () => {
    const persistenceFailure = new Error("controlled persistence failure");
    saveContactRequestMock.mockRejectedValueOnce(persistenceFailure);

    await expect(handleContactSubmission(studentPayload)).rejects.toBe(persistenceFailure);
    expect(saveContactRequestMock).toHaveBeenCalledOnce();
  });
});
