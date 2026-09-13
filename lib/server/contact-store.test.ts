import { describe, expect, it, vi } from "vitest";

import {
  ContactStoreError,
  createContactStore,
  type ContactRequestRecord,
  type ContactRequestWriter,
  type PersistedPartnerContactPayload,
  type PersistedStudentContactPayload,
} from "./contact-store";

const studentPayload: PersistedStudentContactPayload = {
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
};

const partnerPayload: PersistedPartnerContactPayload = {
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
};

function successfulWriter() {
  const records: ContactRequestRecord[] = [];
  const insert = vi.fn(async (record: ContactRequestRecord) => {
    records.push(record);
    return { id: record.id };
  });
  const writer: ContactRequestWriter = { insert };

  return { insert, records, writer };
}

describe("contact store", () => {
  it("durably inserts one complete student request with operational fields", async () => {
    const { insert, records, writer } = successfulWriter();
    const timestamp = new Date("2026-09-03T12:30:00.000Z");
    const id = "1689d573-2a28-44c8-a1ff-4c04fbf43c49";
    const save = createContactStore(writer, {
      createId: () => id,
      now: () => timestamp,
    });

    const result = await save(studentPayload);

    expect(insert).toHaveBeenCalledOnce();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      id,
      type: "student",
      status: "NEW",
      name: studentPayload.name,
      contact: studentPayload.contact,
      payload: studentPayload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(result).toEqual(records[0]);
    expect(records[0].payload).toEqual(studentPayload);
    expect(records[0].payload).not.toHaveProperty("company");
  });

  it("durably inserts one complete partner request", async () => {
    const { insert, records, writer } = successfulWriter();
    const save = createContactStore(writer);

    await save(partnerPayload);

    expect(insert).toHaveBeenCalledOnce();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      type: "partner",
      status: "NEW",
      name: partnerPayload.name,
      contact: partnerPayload.contact,
      payload: partnerPayload,
    });
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
    expect(records[0].payload).not.toHaveProperty("company");
  });

  it("generates a stable unique UUID for each persisted record", async () => {
    const { records, writer } = successfulWriter();
    const save = createContactStore(writer);

    const first = await save(studentPayload);
    const second = await save(partnerPayload);

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(first.id).not.toBe(second.id);
    expect(records.map(({ id }) => id)).toEqual([first.id, second.id]);
  });

  it("wraps a database write failure in a controlled error", async () => {
    const databaseFailure = new Error("database details must stay internal");
    const writer: ContactRequestWriter = {
      insert: vi.fn().mockRejectedValue(databaseFailure),
    };
    const save = createContactStore(writer);

    const persistence = save(studentPayload);

    await expect(persistence).rejects.toMatchObject({
      name: "ContactStoreError",
      code: "CONTACT_PERSISTENCE_FAILED",
      message: "Contact request persistence failed",
      cause: databaseFailure,
    });
  });

  it("fails when the database does not confirm the inserted id", async () => {
    const writer: ContactRequestWriter = {
      insert: vi.fn().mockResolvedValue(null),
    };
    const save = createContactStore(writer);

    await expect(save(studentPayload)).rejects.toBeInstanceOf(ContactStoreError);
  });
});
