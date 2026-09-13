import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSiteAdminSession, isSameOriginAdminRequest, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { CONTACT_REQUEST_STATUSES, readSiteContactRequests, updateSiteContactStatus } from "@/lib/server/contact-store";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const authenticated = (request: NextRequest) => getSiteAdminSession(request.cookies.get(SITE_ADMIN_SESSION_COOKIE)?.value);
export async function GET(request: NextRequest) {
  if (!authenticated(request)) return reply({ error: "AUTH_REQUIRED" }, 401);
  const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return reply({ error: "INVALID_PAGE" }, 400);
  const scope = request.nextUrl.searchParams.get("scope") ?? "production";
  if (!["production", "test"].includes(scope)) return reply({ error: "INVALID_SCOPE" }, 400);
  try { return reply(scope === "test" ? await readSiteContactRequests(page, true) : await readSiteContactRequests(page)); }
  catch { return reply({ error: "CONTACTS_UNAVAILABLE" }, 503); }
}
const patchSchema = z.object({ id: z.string().uuid(), status: z.enum(CONTACT_REQUEST_STATUSES), expected_status: z.enum(CONTACT_REQUEST_STATUSES) }).strict();
export async function PATCH(request: NextRequest) {
  if (!authenticated(request)) return reply({ error: "AUTH_REQUIRED" }, 401);
  if (!isSameOriginAdminRequest(request)) return reply({ error: "CSRF_VALIDATION_FAILED" }, 403);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "INVALID_REQUEST" }, 400);
  try {
    const result = await updateSiteContactStatus(parsed.data.id, parsed.data.status, parsed.data.expected_status);
    return result ? reply(result) : reply({ error: "STATUS_CONFLICT_OR_NOT_FOUND" }, 409);
  } catch { return reply({ error: "CONTACTS_UNAVAILABLE" }, 503); }
}
