import { describe, expect, it } from "vitest";

import {
  contactRequestSchema,
  partnerContactRequestSchema,
  studentContactRequestSchema,
} from "./contact-schema";

const studentPayload = {
  type: "student",
  name: "Anna Test",
  ageGroup: "unter_16",
  level: "A1",
  goals: ["alltag"],
  format: "individual",
  timeSlots: ["morning"],
  frequency: "once",
  budget: "",
  contact: "anna@example.com",
  message: "",
  company: "honeypot-value",
} as const;

const partnerPayload = {
  type: "partner",
  name: "Learn Academy",
  partnerType: "tutor",
  country: "Berlin",
  studentCount: "bis_10",
  offerings: ["teaching"],
  contact: "@learn_academy",
  website: "",
  idea: "Gemeinsame Prüfungsvorbereitung",
  startTimeline: "asap",
  company: "honeypot-value",
} as const;

describe("contact request contract", () => {
  it("accepts the complete student payload including the company honeypot", () => {
    expect(studentContactRequestSchema.parse(studentPayload)).toEqual(studentPayload);
    expect(contactRequestSchema.parse(studentPayload)).toEqual(studentPayload);
  });

  it("accepts the complete partner payload including the company honeypot", () => {
    expect(partnerContactRequestSchema.parse(partnerPayload)).toEqual(partnerPayload);
    expect(contactRequestSchema.parse(partnerPayload)).toEqual(partnerPayload);
  });

  it("rejects values outside the form enums", () => {
    expect(
      studentContactRequestSchema.safeParse({ ...studentPayload, level: "INVALID" }).success,
    ).toBe(false);
    expect(
      partnerContactRequestSchema.safeParse({ ...partnerPayload, partnerType: "INVALID" }).success,
    ).toBe(false);
  });
});
