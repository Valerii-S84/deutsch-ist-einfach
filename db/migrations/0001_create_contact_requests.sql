BEGIN;

CREATE TABLE contact_requests (
    id uuid PRIMARY KEY,
    type text NOT NULL,
    status text NOT NULL DEFAULT 'NEW',
    name text NOT NULL,
    contact text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contact_requests_type_check
        CHECK (type IN ('student', 'partner')),
    CONSTRAINT contact_requests_status_check
        CHECK (status IN ('NEW', 'IN_PROGRESS', 'DONE', 'SPAM')),
    CONSTRAINT contact_requests_payload_object_check
        CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT contact_requests_payload_type_check
        CHECK (payload ->> 'type' = type),
    CONSTRAINT contact_requests_payload_honeypot_check
        CHECK (NOT (payload ? 'company')),
    CONSTRAINT contact_requests_timestamps_check
        CHECK (updated_at >= created_at)
);

CREATE INDEX contact_requests_status_created_at_idx
    ON contact_requests (status, created_at DESC);

COMMIT;
