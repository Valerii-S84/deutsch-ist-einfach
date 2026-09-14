CREATE TABLE IF NOT EXISTS analytics_excluded_visitors (
  product_id text NOT NULL,
  visitor_id uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_id, visitor_id)
);

-- Preserve raw test evidence while excluding it consistently from every report.
CREATE OR REPLACE VIEW analytics_report_events AS
SELECT e.* FROM analytics_events e
WHERE NOT EXISTS (
  SELECT 1 FROM analytics_excluded_visitors x
  WHERE x.product_id = e.product_id AND x.visitor_id = e.visitor_id
);
