import { MAX_BATCH_BYTES, MAX_BATCH_EVENTS, type AnalyticsEvent } from "./contract";

const ENDPOINT = "/api/public/analytics/events";
const TTL = 300_000;
const RETRIES = [1000, 5000, 15_000];
type Pending = { event: AnalyticsEvent; attempts: number; due: number; beaconAttempted: boolean };

export class AnalyticsTransport {
  private queue: Pending[] = [];
  private controller: AbortController | null = null;
  private interval: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(private allowed: () => boolean) {
    this.interval = setInterval(() => { void this.flush(); }, 10_000);
  }

  enqueue(event: AnalyticsEvent) {
    if (this.stopped || !this.allowed()) return;
    this.prune();
    if (this.queue.length >= 100) this.queue.shift();
    this.queue.push({ event, attempts: 0, due: 0, beaconAttempted: false });
  }

  private prune() {
    const cutoff = Date.now() - TTL;
    this.queue = this.queue.filter(item => Date.parse(item.event.occurred_at) > cutoff);
  }

  private batch(candidates: Pending[]) {
    const batch: Pending[] = [];
    for (const item of candidates) {
      if (batch.length === MAX_BATCH_EVENTS) break;
      if (new TextEncoder().encode(JSON.stringify({ events: [...batch, item].map(row => row.event) })).length > MAX_BATCH_BYTES) break;
      batch.push(item);
    }
    return batch;
  }

  async flush(): Promise<void> {
    if (this.stopped || this.controller) return;
    if (!this.allowed()) { this.stop(); return; }
    this.prune();
    const batch = this.batch(this.queue.filter(item => item.due <= Date.now()));
    if (!batch.length) return;
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 5000);
    let retry = false;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch.map(item => item.event) }),
        credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      });
      retry = response.status === 429 || response.status >= 500;
      if (response.ok) {
        // A queued beacon or an arbitrary 2xx is not a database acknowledgement.
        const ack = await response.json().catch(() => null);
        if (!ack || ack.accepted !== batch.length || !Number.isInteger(ack.inserted) || !Number.isInteger(ack.duplicates) || ack.inserted < 0 || ack.duplicates < 0 || ack.inserted + ack.duplicates !== batch.length) {
          // Invalid successful responses are discarded, not retried as network failures.
          retry = false;
        }
      }
    } catch { retry = true; }
    finally { clearTimeout(timeout); this.controller = null; }
    if (this.stopped) return;
    const remove = new Set<Pending>();
    for (const item of batch) {
      if (retry && item.attempts < RETRIES.length) item.due = Date.now() + RETRIES[item.attempts++];
      else remove.add(item);
    }
    this.queue = this.queue.filter(item => !remove.has(item));
    this.prune();
    clearTimeout(this.retryTimer);
    if (this.queue.length) {
      const due = Math.min(...this.queue.map(item => item.due));
      this.retryTimer = setTimeout(() => { void this.flush(); }, Math.max(0, due - Date.now()));
    }
  }

  lastAttempt() {
    if (this.stopped || !this.allowed()) { this.stop(); return; }
    this.prune();
    const batch = this.batch(this.queue.filter(item => !item.beaconAttempted));
    if (!batch.length) return;
    for (const item of batch) item.beaconAttempted = true;
    try {
      navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify({ events: batch.map(item => item.event) })], { type: "application/json" }));
    } catch { /* Best effort. Keep IDs for a later acknowledged fetch if the page resumes. */ }
  }

  stop() {
    this.stopped = true;
    this.queue = [];
    this.controller?.abort();
    clearInterval(this.interval);
    clearTimeout(this.retryTimer);
  }
}
