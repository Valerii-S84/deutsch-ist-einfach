import { z } from "zod";

const count = z.number().int().nonnegative().safe();
const promoId = z.union([count, z.string().regex(/^[1-9]\d*$/)]).transform(String);
const amount = z.number().finite().nonnegative();
const text = z.string();
const date = z.string().datetime({ offset: true });
const object = z.object;
const list = <T extends z.ZodTypeAny>(item: T) => object({ items: z.array(item), total: count, page: count, pages: count }).passthrough();
const promo = object({
  id: promoId, code: text, code_prefix: text, raw_code: text.nullable(), can_reveal_code: z.boolean(),
  campaign_name: text, discount_type: text.nullable(), discount_value: amount.nullable(),
  applicable_products: z.array(text).nullable(), valid_from: date, valid_until: date.nullable(),
  max_total_uses: count, max_per_user: count, used_total: count,
  status: z.enum(["active", "inactive", "expired"]), created_at: date, updated_at: date,
}).passthrough();

const schemas: Record<string, z.ZodTypeAny> = {
  "/admin/users": list(object({ id: count, telegram_user_id: count, username: text.nullable(), first_name: text.nullable(), language: text.nullable(), status: text, created_at: date, last_seen_at: date.nullable(), streak: count, daily_challenge_score: amount, daily_challenge_completed_runs: count })),
  "/admin/economy/purchases": list(object({ id: text, user_id: count, username: text.nullable(), product: text, stars: count, eur: amount, date: date.nullable(), source: text, utm: z.unknown(), status: text })).extend({ charts: object({ revenue_by_product: z.array(object({ product: text, stars: count, eur: amount })), ltv_30d_by_cohort: z.array(object({ cohort_week: text, cohort_size: count, revenue_stars_30d: count, ltv_stars_30d: amount, ltv_eur_30d: amount })) }) }),
  "/admin/economy/subscriptions": object({ total: count, items: z.array(object({ id: count, user_id: count, username: text.nullable(), status: text, starts_at: date, ends_at: date.nullable() })) }),
  "/admin/economy/cohorts": object({ week_offsets: z.array(count), cohorts: z.array(object({ cohort_week: text, users: count }).catchall(z.union([amount, text]))) }),
  "/admin/content": object({
    level_stats: z.array(object({ level: text, total_questions: count, attempts: count, coverage_percent: amount })),
    flagged_questions: z.array(object({ id: count, user_id: count, reason: text, payload: z.record(z.unknown()), created_at: date })),
    grammar_pipeline: object({ status: text, updated_at: date.nullable(), payload: z.record(z.unknown()) }),
    duplicates: z.array(object({ question_text: text, count })),
    mode_level_distribution: z.array(object({ mode_code: text, level: text, attempts: count, percent_in_mode: amount, percent_of_all_attempts: amount })),
  }),
  "/admin/system": object({
    services: z.record(object({ ok: z.boolean(), workers: z.array(text).optional(), processed_updates_15m: count.optional() })),
    error_log: z.array(object({ event_type: text, status: text, created_at: date })),
    top_10_errors: z.array(object({ type: text, count })), queue_stats: object({ pending: count, failed: count }),
    api_latency: z.array(object({ date: text, p50: amount.nullable(), p95: amount.nullable() })),
  }),
  "/admin/promo/products": object({ items: z.array(object({ id: text, title: text, product_type: text, stars_amount: count })) }),
  "/admin/promo/check-code": object({ normalized_code: text, exists: z.boolean() }),
  "/admin/promo/bulk-generate": object({ generated: count, codes: z.array(text), items: z.array(promo) }),
  "/admin/auth/session": object({ email: text, role: text, two_factor_verified: z.boolean() }),
  "/admin/auth/login": object({ requires_2fa: z.boolean() }).passthrough(),
};

// Validate the historical DTO at the boundary. Invalid payloads never reach cards.
export function validateQuizPayload(path: string, method: string, payload: unknown): unknown {
  let schema = schemas[path];
  if (path === "/admin/promo") schema = method === "GET" ? list(promo) : promo;
  if (/^\/admin\/promo\/\d+(\/(toggle|reveal))?$/.test(path)) schema = promo;
  if (/^\/admin\/promo\/\d+\/revoke$/.test(path)) schema = object({ revoked_count: count });
  if (/^\/admin\/promo\/\d+\/stats$/.test(path)) schema = object({ used_total: count, reserved_active: count, status_totals: z.record(count), redemptions: z.array(object({ user_id: count, redeemed_at: date, status: text, product_id: text.nullable() })) });
  if (/^\/admin\/promo\/\d+\/audit$/.test(path)) schema = object({ items: z.array(object({ id: text, action: text, admin: text, created_at: date, details: z.record(z.unknown()) })) });
  if (!schema) return payload;
  const result = schema.safeParse(payload);
  if (!result.success) throw new Error("QUIZ_INVALID_PAYLOAD");
  return result.data;
}
