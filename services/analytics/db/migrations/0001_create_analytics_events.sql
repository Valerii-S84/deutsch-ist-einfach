CREATE TABLE IF NOT EXISTS analytics_events (
  product_id text NOT NULL CHECK (product_id = 'deutschmit'),
  event_id uuid NOT NULL,
  event_name text NOT NULL CHECK (event_name IN (
    'session_start', 'page_view', 'page_leave', 'element_impression', 'element_click',
    'scroll_depth', 'engagement', 'article_read', 'quiz_started', 'quiz_completed',
    'form_open', 'form_submit', 'form_success', 'form_error', 'frontend_error'
  )),
  schema_version smallint NOT NULL CHECK (schema_version = 1),
  source text NOT NULL CHECK (source IN ('browser', 'server')),
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  page_view_id uuid NOT NULL,
  sequence integer CHECK (sequence > 0),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  path text NOT NULL,
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT analytics_events_product_event_unique UNIQUE (product_id, event_id),
  CHECK ((source = 'server' AND event_name = 'form_success' AND sequence IS NULL)
      OR (source = 'browser' AND event_name <> 'form_success' AND sequence IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS analytics_events_product_time ON analytics_events (product_id, occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_product_session_time ON analytics_events (product_id, session_id, occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_product_name_time ON analytics_events (product_id, event_name, occurred_at);
