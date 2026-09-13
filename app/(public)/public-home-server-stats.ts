import { apiRoutes } from "@/lib/api-routes";
import { getServerApiUrl } from "@/lib/api-config";
import { parsePublicStatsPayload } from "@/lib/statistics-payload";

import {
  createUnavailableStatsState,
  normalizePublicStats,
} from "./public-home-helpers";
import type { StatsState } from "./public-home-types";

export async function fetchPublicHomeServerStats(): Promise<StatsState> {
  const statsUrl = getServerApiUrl(apiRoutes.public.stats);
  if (!statsUrl) {
    return createUnavailableStatsState();
  }

  try {
    const response = await fetch(statsUrl, {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      return createUnavailableStatsState();
    }

    const payload = await response.json();
    return normalizePublicStats(parsePublicStatsPayload(payload));
  } catch {
    return createUnavailableStatsState();
  }
}
