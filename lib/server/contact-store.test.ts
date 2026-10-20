import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContactStoreError,
  CONTACT_REQUEST_RETENTION_MONTHS,
  createContactStore,
  purgeExpiredContactRequests,
  readSiteContactRequests,
  saveContactRequest,
  type ContactRequestRecord,
  type ContactRequestWriter,
  type PersistedPartnerContactPayload,
  type PersistedStudentContactPayload,
} from "./contact-store";

const database = vi.hoisted(() => ({
  sql: Object.assign(vi.fn(), { json: vi.fn((payload: unknown) => payload), begin: vi.fn() }),
}));

vi.mock("postgres", () => ({ default: vi.fn(() => database.sql) }));

const studentPayload: PersistedStudentContactPayload = {
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

describe("строк зберігання контактних заявок", () => {
  beforeEach(() => {
    database.sql.mockReset();
    database.sql.json.mockClear();
    database.sql.begin.mockReset();
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/contact-retention-test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("видаляє всі статуси й тестові заявки за updated_at через параметр шести місяців", async () => {
    database.sql.mockResolvedValue([]);

    await purgeExpiredContactRequests();

    expect(CONTACT_REQUEST_RETENTION_MONTHS).toBe(6);
    expect(database.sql).toHaveBeenCalledOnce();
    const [strings, ...parameters] = database.sql.mock.calls[0];
    expect(strings.join("?")).toBe(
      "DELETE FROM contact_requests WHERE updated_at < now() - make_interval(months => ?)",
    );
    expect(parameters).toEqual([6]);
  });

  it("очищує заявки після підтвердженого INSERT", async () => {
    database.sql.mockImplementationOnce(async (_strings, id: string) => [{ id }]);
    database.sql.mockResolvedValueOnce([]);

    const record = await saveContactRequest(studentPayload);

    expect(record.payload).toEqual(studentPayload);
    expect(database.sql).toHaveBeenCalledTimes(2);
    expect(database.sql.mock.calls[0][0].join("?")).toContain("INSERT INTO contact_requests");
    expect(database.sql.mock.calls[1][0].join("?")).toContain("DELETE FROM contact_requests");
  });

  it("очищує заявки до початку read-only транзакції", async () => {
    database.sql.mockResolvedValue([]);
    const transaction = vi.fn().mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id: "synthetic" }]);
    database.sql.begin.mockImplementation(async (_options, read) => read(transaction));

    const result = await readSiteContactRequests(1, true);

    expect(result).toEqual({ items: [{ id: "synthetic" }], total: 1, page: 1, pages: 1 });
    expect(database.sql).toHaveBeenCalledOnce();
    expect(database.sql.begin).toHaveBeenCalledWith("isolation level repeatable read read only", expect.any(Function));
    expect(database.sql.mock.invocationCallOrder[0]).toBeLessThan(database.sql.begin.mock.invocationCallOrder[0]);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("не запускає очищення після невдалого INSERT", async () => {
    database.sql.mockRejectedValueOnce(new Error("synthetic insert failure"));

    await expect(saveContactRequest(studentPayload)).rejects.toBeInstanceOf(ContactStoreError);

    expect(database.sql).toHaveBeenCalledOnce();
  });

  it.each(["save", "read"])("помилка очищення не ламає %s і не потрапляє до журналу", async operation => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("synthetic private database details");
    if (operation === "save") {
      database.sql.mockImplementationOnce(async (_strings, id: string) => [{ id }]);
      database.sql.mockRejectedValueOnce(failure);

      await expect(saveContactRequest(studentPayload)).resolves.toMatchObject({ payload: studentPayload });
    } else {
      database.sql.mockRejectedValueOnce(failure);
      const transaction = vi.fn().mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      database.sql.begin.mockImplementation(async (_options, read) => read(transaction));

      await expect(readSiteContactRequests(1)).resolves.toEqual({ items: [], total: 0, page: 1, pages: 1 });
    }

    expect(log).toHaveBeenCalledExactlyOnceWith("CONTACT_RETENTION_FAILED");
  });
});
