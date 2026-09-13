import { randomUUID } from "node:crypto";

import postgres from "postgres";

import type {
  PartnerContactRequest,
  StudentContactRequest,
} from "@/lib/contact/contact-schema";

export const CONTACT_REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "DONE", "SPAM"] as const;

export type ContactRequestStatus = (typeof CONTACT_REQUEST_STATUSES)[number];
export type PersistedStudentContactPayload = Omit<StudentContactRequest, "company">;
export type PersistedPartnerContactPayload = Omit<PartnerContactRequest, "company">;
export type PersistedContactPayload =
  | PersistedStudentContactPayload
  | PersistedPartnerContactPayload;

export type ContactRequestRecord = {
  id: string;
  type: PersistedContactPayload["type"];
  status: ContactRequestStatus;
  name: string;
  contact: string;
  payload: PersistedContactPayload;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactRequestInsertResult = {
  id: string;
};

export interface ContactRequestWriter {
  insert(record: ContactRequestRecord): Promise<ContactRequestInsertResult | null>;
}

type ContactStoreDependencies = {
  createId?: () => string;
  now?: () => Date;
};

export class ContactStoreError extends Error {
  readonly code = "CONTACT_PERSISTENCE_FAILED";

  constructor(cause?: unknown) {
    super("Contact request persistence failed", { cause });
    this.name = "ContactStoreError";
  }
}

function createRecord(
  payload: PersistedContactPayload,
  createId: () => string,
  now: () => Date,
): ContactRequestRecord {
  const timestamp = now();

  return {
    id: createId(),
    type: payload.type,
    status: "NEW",
    name: payload.name,
    contact: payload.contact,
    payload,
    createdAt: new Date(timestamp.getTime()),
    updatedAt: new Date(timestamp.getTime()),
  };
}

export function createContactStore(
  writer: ContactRequestWriter,
  dependencies: ContactStoreDependencies = {},
) {
  const createId = dependencies.createId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return async function persistContactRequest(
    payload: PersistedContactPayload,
  ): Promise<ContactRequestRecord> {
    const record = createRecord(payload, createId, now);

    let result: ContactRequestInsertResult | null;
    try {
      result = await writer.insert(record);
    } catch (cause) {
      if (cause instanceof ContactStoreError) {
        throw cause;
      }

      throw new ContactStoreError(cause);
    }

    if (!result || result.id !== record.id) {
      throw new ContactStoreError();
    }

    return record;
  };
}

let databaseClient: ReturnType<typeof postgres> | undefined;

function getDatabaseClient(): ReturnType<typeof postgres> {
  if (databaseClient) {
    return databaseClient;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new ContactStoreError();
  }

  databaseClient = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return databaseClient;
}

const postgresContactRequestWriter: ContactRequestWriter = {
  async insert(record) {
    const sql = getDatabaseClient();
    const rows = await sql<{ id: string }[]>`
      INSERT INTO contact_requests (
        id,
        type,
        status,
        name,
        contact,
        payload,
        created_at,
        updated_at
      )
      VALUES (
        ${record.id},
        ${record.type},
        ${record.status},
        ${record.name},
        ${record.contact},
        ${sql.json(record.payload)},
        ${record.createdAt},
        ${record.updatedAt}
      )
      RETURNING id::text AS id
    `;

    return rows.length === 1 ? rows[0] : null;
  },
};

const persistContactRequest = createContactStore(postgresContactRequestWriter);

export async function saveContactRequest(
  payload: PersistedContactPayload,
): Promise<ContactRequestRecord> {
  return persistContactRequest(payload);
}

// Site-owned administrative access; never reads Quiz Arena storage.
export async function readSiteContactRequests(page: number) {
  const sql = getDatabaseClient();
  return sql.begin("isolation level repeatable read read only", async transaction => {
    const totals = await transaction`SELECT count(*)::int AS total FROM contact_requests`;
    const items = await transaction`SELECT id::text, type, status, name, contact, payload, created_at, updated_at
      FROM contact_requests ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`;
    return { items: [...items], total: totals[0].total as number, page, pages: Math.max(1, Math.ceil(totals[0].total / 20)) };
  });
}
export async function updateSiteContactStatus(id: string, status: ContactRequestStatus, expectedStatus: ContactRequestStatus): Promise<{ id: string; status: ContactRequestStatus } | null> {
  const sql = getDatabaseClient();
  const rows = await sql<{ id: string; status: ContactRequestStatus }[]>`UPDATE contact_requests SET status = ${status}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}::uuid AND status = ${expectedStatus} RETURNING id::text, status`;
  return rows[0] ?? null;
}
