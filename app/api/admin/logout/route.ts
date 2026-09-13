import { NextResponse } from "next/server";

import {
  isSameOriginAdminRequest,
  SITE_ADMIN_SESSION_COOKIE,
  siteAdminCookieOptions,
} from "@/lib/server/site-admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginAdminRequest(request)) {
    return NextResponse.json({ error: "FORBIDDEN" }, {
      status: 403, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/admin/login", "Cache-Control": "private, no-store" },
  });
  response.cookies.set(SITE_ADMIN_SESSION_COOKIE, "", {
    ...siteAdminCookieOptions(), maxAge: 0, expires: new Date(0),
  });
  return response;
}
