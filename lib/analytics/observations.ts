import { ARTICLE_EMBEDS } from "../article-definitions";
import { analyticsElement } from "./elements";

type Emit = (name: "element_impression" | "scroll_depth" | "engagement" | "article_read", metadata: Record<string, unknown>) => void;
type Coverage = { intervals: Array<[number, number]>; height: number };

function visibleBounds(element: HTMLElement) {
  if (!element.getClientRects().length || element.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
  const style = getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return null;
  return element.getBoundingClientRect();
}

export class PageObservations {
  scroll = 0;
  private impressions = new Set<string>();
  private visibleSince = new Map<HTMLElement, number>();
  private thresholds = new Set<number>();
  private coverage = new Map<HTMLElement, Coverage>();
  private read = false;
  private lastEngagement = 0;
  private lastActive = 0;

  constructor(private emit: Emit, now = Date.now()) { this.lastEngagement = now; }

  pause() { this.visibleSince.clear(); }

  sample(active: number, now = Date.now()) {
    if (document.visibilityState !== "visible" || !document.hasFocus()) { this.pause(); return; }
    for (const element of document.querySelectorAll<HTMLElement>("[data-analytics-id]")) {
      const label = analyticsElement(element.dataset.analyticsId, element.dataset.analyticsPlacement);
      if (!label) continue;
      const key = `${label.element_id}:${label.placement}`;
      if (this.impressions.has(key)) continue;
      const rect = visibleBounds(element);
      const area = rect ? Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) * Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) : 0;
      if (!rect || rect.width * rect.height <= 0 || area / (rect.width * rect.height) < 0.5) { this.visibleSince.delete(element); continue; }
      if (!this.visibleSince.has(element)) this.visibleSince.set(element, now);
      if (now - this.visibleSince.get(element)! >= 1000) {
        this.impressions.add(key);
        this.emit("element_impression", { element_id: label.element_id, placement: label.placement });
      }
    }
    for (const element of this.visibleSince.keys()) if (!element.isConnected) this.visibleSince.delete(element);
    const content = document.querySelector<HTMLElement>("[data-analytics-content]") ?? document.querySelector<HTMLElement>("main");
    const rect = content && visibleBounds(content);
    if (rect && rect.height > 0) {
      this.scroll = Math.max(this.scroll, Math.round(Math.min(100, Math.max(0, (innerHeight - rect.top) / rect.height * 100))));
      for (const threshold of [25, 50, 75, 90]) if (this.scroll >= threshold && !this.thresholds.has(threshold)) {
        this.thresholds.add(threshold); this.emit("scroll_depth", { threshold });
      }
    }
    if (now - this.lastEngagement >= 30_000 && active > this.lastActive) {
      this.lastEngagement = now; this.lastActive = active;
      this.emit("engagement", { active_ms: Math.round(active) });
    }
    const articleId = content?.dataset.analyticsArticle;
    if (!content || !articleId || !Object.hasOwn(ARTICLE_EMBEDS, articleId) || this.read) return;
    const bodies = [...content.querySelectorAll<HTMLElement>(".card-body, .prov-body, .era-body")];
    for (const body of bodies) {
      if (!body.closest(".level-card.open, .prov-card.open, .era-card.open")) continue;
      const bounds = visibleBounds(body);
      if (!bounds || bounds.height <= 0) continue;
      const start = Math.max(0, -bounds.top), end = Math.min(bounds.height, innerHeight - bounds.top);
      if (end <= start) continue;
      const covered = this.coverage.get(body) ?? { intervals: [], height: bounds.height };
      // Responsive reflow changes the coordinate system; require fresh coverage.
      if (Math.abs(covered.height - bounds.height) > 2) covered.intervals = [];
      covered.height = bounds.height;
      covered.intervals.push([start, end]);
      covered.intervals.sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];
      for (const interval of covered.intervals) {
        const previous = merged.at(-1);
        if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
        else merged.push(interval);
      }
      covered.intervals = merged; this.coverage.set(body, covered);
    }
    const disclosed = bodies.every(body => {
      const covered = this.coverage.get(body);
      return covered && covered.intervals.reduce((total, [start, end]) => total + end - start, 0) / covered.height >= 0.9;
    });
    if (active >= 60_000 && this.scroll >= 90 && disclosed) {
      this.read = true; this.emit("article_read", { article_id: articleId, rule_version: 1 });
    }
  }
}
