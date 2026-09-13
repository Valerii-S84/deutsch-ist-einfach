import {
  PUBLIC_VISITOR_ID_STORAGE_KEY,
  PUBLIC_VISITOR_AGE_STORAGE_KEY,
  ANALYTICS_CONSENT_STORAGE_KEY,
  type PublicAnalyticsPayload,
  type WebsiteAnalyticsEventType,
} from "@/lib/analytics";
import { normalizeAnalyticsPath } from "@/lib/analytics/contract";
import { readTraffic, VISITOR_TTL } from "@/lib/analytics/identity";

type WebsiteAnalyticsPayload = {
  event_type: WebsiteAnalyticsEventType;
  visitor_id: string;
  path: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type SendWebsiteAnalyticsEventInput = {
  eventType: WebsiteAnalyticsEventType;
  path?: string;
  timestamp?: string;
  metadata?: PublicAnalyticsPayload;
};

const VISITOR_ID_MIN_LENGTH = 16;
const VISITOR_ID_MAX_LENGTH = 128;
const ALLOWED_METADATA_KEYS = new Set([
  "public_event_name",
  "section",
  "cta",
  "destination",
  "question_index",
  "score",
  "article_slug",
]);

function randomFallbackId(): string {
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return randomFallbackId();
}

function isValidVisitorId(value: string | null): value is string {
  if (!value) {
    return false;
  }
  return value.length >= VISITOR_ID_MIN_LENGTH && value.length <= VISITOR_ID_MAX_LENGTH;
}

export function getOrCreatePublicVisitorId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    if (window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) !== "granted") return null;
    const storedValue = window.localStorage.getItem(PUBLIC_VISITOR_ID_STORAGE_KEY);
    let age: { id?: unknown; created?: unknown } | null = null;
    try { age = JSON.parse(window.localStorage.getItem(PUBLIC_VISITOR_AGE_STORAGE_KEY) ?? "null"); } catch {}
    const now = Date.now();
    if (isValidVisitorId(storedValue) && age?.id === storedValue && typeof age.created === "number"
      && Number.isFinite(age.created) && age.created >= 0 && age.created <= now && now - age.created < VISITOR_TTL) return storedValue;
    // Existing IDs without a known creation date rotate once; do not reset their age
    // on every visit. Keep the legacy string ID format for existing clients.
    const visitorId = createVisitorId();
    window.localStorage.setItem(PUBLIC_VISITOR_AGE_STORAGE_KEY, JSON.stringify({ id: visitorId, created: now }));
    window.localStorage.setItem(PUBLIC_VISITOR_ID_STORAGE_KEY, visitorId);
    return visitorId;
  } catch { return null; }
}

function currentPath(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return window.location.pathname || "/";
}

function sanitizeMetadata(
  metadata: PublicAnalyticsPayload | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key) || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 200);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function buildPayload(input: SendWebsiteAnalyticsEventInput): WebsiteAnalyticsPayload | null {
  const visitorId = getOrCreatePublicVisitorId();
  if (!visitorId) {
    return null;
  }

  return {
    event_type: input.eventType,
    visitor_id: visitorId,
    path: normalizeAnalyticsPath(input.path ?? currentPath()),
    referrer: readTraffic().referrer_host,
    utm_source: readTraffic().utm_source,
    utm_medium: readTraffic().utm_medium,
    utm_campaign: readTraffic().utm_campaign,
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: sanitizeMetadata(input.metadata),
  };
}

export function sendWebsiteAnalyticsEvent(input: SendWebsiteAnalyticsEventInput): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const payload = buildPayload(input);
  if (!payload) {
    return false;
  }

  const body = JSON.stringify(payload);
  const url = "/api/public/website-analytics/events";

  try { if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      url,
      new Blob([body], { type: "application/json" }),
    );
    if (sent) {
      return true;
    }
  }

  } catch { /* A blocked beacon must not interrupt navigation. */ }

  if (typeof fetch !== "function") {
    return false;
  }

  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    return false;
  }

  return true;
}
