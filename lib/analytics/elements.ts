import { ARTICLE_EMBEDS } from "../article-definitions";

export type Destination = "internal" | "telegram" | "youtube" | "amazon" | "download" | "other";
const elements: Record<string, Destination> = {
  telegram_bot: "telegram", telegram_channel: "telegram", deutsch_trainer: "telegram",
  quiz_teaser_anchor: "internal", youtube_channel: "youtube", worklog_apk: "download",
  shorts_blocker: "other", books: "internal", book_print: "amazon", book_ebook: "amazon",
  nav_home: "internal", nav_projects: "internal", nav_wissen: "internal", nav_learning: "internal",
  nav_contact: "internal", nav_menu: "internal", student_form: "internal", partner_form: "internal",
  ...Object.fromEntries(Object.keys(ARTICLE_EMBEDS).map(slug => [`article_${slug}`, "internal" as const])),
};
const placements = new Set(["header", "header_mobile", "hero", "channel", "product_card", "quiz_teaser", "article_kurzantwort", "home_projects", "home_articles", "wissen", "related_articles", "projects", "books", "home_contact", "contact", "footer"]);

export function analyticsElement(id: unknown, placement: unknown) {
  if (typeof id !== "string" || !Object.hasOwn(elements, id) || typeof placement !== "string" || !placements.has(placement)) return null;
  return { element_id: id, placement, destination: elements[id] };
}

// Explicit call sites own their clicks; these attributes also enable impressions.
export function analyticsAttributes(id: string, placement: string, explicit = false) {
  return { "data-analytics-id": id, "data-analytics-placement": placement, ...(explicit ? { "data-analytics-explicit": "true" } : {}) };
}
