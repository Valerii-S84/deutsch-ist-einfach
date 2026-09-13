import { NextRequest } from "next/server";
import { handleAnalyticsReport } from "@/lib/server/analytics-report-route";
import { readAnalyticsPages } from "@/lib/server/analytics-service-client";

export const runtime = "nodejs";
export async function GET(request: NextRequest) { return handleAnalyticsReport(request, readAnalyticsPages); }
