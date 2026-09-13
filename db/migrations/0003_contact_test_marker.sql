ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
