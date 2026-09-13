BEGIN;

CREATE TABLE website_analytics_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type text NOT NULL,
    visitor_id text NOT NULL,
    path text NOT NULL,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    event_timestamp timestamptz NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT website_analytics_events_event_type_check
        CHECK (event_type IN ('page_view', 'telegram_cta_click')),
    CONSTRAINT website_analytics_events_visitor_id_length_check
        CHECK (char_length(visitor_id) BETWEEN 16 AND 128),
    CONSTRAINT website_analytics_events_referrer_length_check
        CHECK (referrer IS NULL OR char_length(referrer) <= 512),
    CONSTRAINT website_analytics_events_utm_source_length_check
        CHECK (utm_source IS NULL OR char_length(utm_source) <= 160),
    CONSTRAINT website_analytics_events_utm_medium_length_check
        CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 160),
    CONSTRAINT website_analytics_events_utm_campaign_length_check
        CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 160),
    CONSTRAINT website_analytics_events_metadata_object_check
        CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

COMMIT;
