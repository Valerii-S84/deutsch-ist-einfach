import { apiRoutes } from "./quiz-arena-routes";
import { parseOverviewPayloadSections } from "./quiz-arena-statistics";
import { validateQuizPayload } from "./quiz-arena-contracts";

export class QuizApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export function classifyApiError(error: unknown) {
  if (!(error instanceof QuizApiError)) return "NETWORK_ERROR";
  return ({401: "AUTH_REQUIRED", 403: "AUTH_FORBIDDEN", 429: "TOO_MANY_REQUESTS"} as Record<number, string>)[error.status] ?? "UNKNOWN";
}
async function request<T = any>(method: string, path: string, body?: unknown, params?: Record<string, unknown>): Promise<{ data: T }> {
  if (!path.startsWith("/admin/")) throw new Error("Invalid Quiz Arena route");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) if (value !== undefined) query.set(key, String(value));
  const response = await fetch(`/api/admin/quiz-arena/${path.slice(7)}${query.size ? `?${query}` : ""}`, {
    method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", ...(typeof window !== "undefined" ? { Origin: window.location.origin } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new QuizApiError(response.status, payload.error ?? "QUIZ_REQUEST_FAILED");
  }
  return { data: validateQuizPayload(path, method, await response.json()) as T };
}
export const api = {
  get: <T = any>(path: string, options?: { params?: Record<string, unknown> }) => request<T>("GET", path, undefined, options?.params),
  post: <T = any>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T = any>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};

export async function fetchOverview(period: string) {
  const { data } = await api.get(apiRoutes.admin.overview, { params: { period } });
  const parsed = parseOverviewPayloadSections(data);
  if (parsed.period !== period) throw new Error("QUIZ_PERIOD_MISMATCH");
  return parsed;
}

export async function fetchEconomyPurchases() {
  const { data } = await api.get(apiRoutes.admin.economy.purchases, {
    params: { page: 1, limit: 50 },
  });
  return data;
}

export async function fetchEconomySubscriptions() {
  const { data } = await api.get(apiRoutes.admin.economy.subscriptions, {
    params: { status: "ACTIVE" },
  });
  return data;
}

export async function fetchEconomyCohorts() {
  const { data } = await api.get(apiRoutes.admin.economy.cohorts);
  return data;
}

export type UserListSortBy = "created_at" | "daily_challenge_rating";

type FetchUsersOptions = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: UserListSortBy;
};

export async function fetchUsers(options: FetchUsersOptions = {}) {
  const { page = 1, limit = 100, search = "", sortBy = "created_at" } = options;
  const { data } = await api.get(apiRoutes.admin.users, {
    params: {
      page,
      limit,
      search,
      sort_by: sortBy,
    },
  });
  return data;
}

export async function fetchPromo(status?: string, query?: string) {
  const { data } = await api.get(apiRoutes.admin.promo.list, {
    params: { page: 1, limit: 100, status, query },
  });
  return data;
}

export async function fetchPromoDetail(promoId: number | string, reveal = false) {
  const { data } = reveal ? await api.post(`${apiRoutes.admin.promo.detail(promoId)}/reveal`) : await api.get(apiRoutes.admin.promo.detail(promoId));
  return data;
}

export async function fetchPromoStats(promoId: number | string) {
  const { data } = await api.get(apiRoutes.admin.promo.stats(promoId));
  return data;
}

export async function fetchPromoAudit(promoId: number | string) {
  const { data } = await api.get(apiRoutes.admin.promo.audit(promoId));
  return data;
}

export async function fetchPromoProducts() {
  const { data } = await api.get(apiRoutes.admin.promo.products);
  return data;
}

export async function fetchPromoCodeAvailability(code: string) {
  const { data } = await api.get(apiRoutes.admin.promo.checkCode, {
    params: { code },
  });
  return data;
}

export async function fetchAdminSession() {
  const { data } = await api.get(apiRoutes.admin.auth.session);
  return data;
}

export async function fetchContentHealth() {
  const { data } = await api.get(apiRoutes.admin.content);
  return data;
}

export async function fetchSystemHealth() {
  const { data } = await api.get(apiRoutes.admin.system);
  return data;
}
