CREATE TABLE IF NOT EXISTS shorts_website_events (
  event_id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL, session_id uuid NOT NULL, page_view_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN ('page_view','element_click','page_leave')),
  occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  sequence integer NOT NULL CHECK (sequence > 0),
  path text NOT NULL CHECK (path IN ('/','/privacy/','/support/','/terms/')),
  element_id text, active_ms integer CHECK (active_ms BETWEEN 0 AND 86400000),
  referrer_host text, device text NOT NULL CHECK (device IN ('mobile','tablet','desktop')),
  is_test boolean NOT NULL DEFAULT false,
  CHECK ((event_name = 'element_click') = (element_id IS NOT NULL)),
  CHECK ((event_name = 'page_leave') = (active_ms IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shorts_website_events_period ON shorts_website_events (occurred_at) WHERE NOT is_test;
CREATE INDEX IF NOT EXISTS shorts_website_events_session ON shorts_website_events (session_id, sequence, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS shorts_website_events_view ON shorts_website_events (page_view_id) WHERE event_name = 'page_view';
