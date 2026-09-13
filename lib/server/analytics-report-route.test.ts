// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "./site-admin-auth";
import * as service from "./analytics-service-client";
import { GET as pages } from "@/app/api/admin/analytics/deutschmit/pages/route";
import { GET as events } from "@/app/api/admin/analytics/deutschmit/events/route";
import { GET as traffic } from "@/app/api/admin/analytics/deutschmit/traffic/route";
import { GET as conversions } from "@/app/api/admin/analytics/deutschmit/conversions/route";
import { GET as sessions } from "@/app/api/admin/analytics/deutschmit/sessions/route";
vi.mock('server-only', () => ({}));
vi.mock('./analytics-service-client', () => ({ readAnalyticsPages: vi.fn(), readAnalyticsEvents: vi.fn(), readAnalyticsTraffic: vi.fn(), readAnalyticsConversions: vi.fn(), readAnalyticsSessions: vi.fn(), AnalyticsServiceError: class extends Error { status = 503; } }));
beforeEach(() => { vi.stubEnv('SITE_ADMIN_EMAIL', 'site@example.test'); vi.stubEnv('SITE_ADMIN_PASSWORD', 'synthetic-password'); vi.stubEnv('SITE_ADMIN_SESSION_SECRET', 'synthetic-signing-key-at-least-32-bytes'); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
function request(path: string, authenticated = true) {
  const token = authenticated ? createSiteAdminSession('site@example.test', 'synthetic-password') : null;
  return new NextRequest('http://localhost/api/admin/analytics/deutschmit/' + path, { headers: token ? { cookie: `${SITE_ADMIN_SESSION_COOKIE}=${token}` } : {} });
}
it.each([
  ['pages', pages, service.readAnalyticsPages], ['events', events, service.readAnalyticsEvents], ['traffic', traffic, service.readAnalyticsTraffic], ['conversions', conversions, service.readAnalyticsConversions],
] as const)('%s enforces auth before service, strict period, no-store and unavailable', async (name, get, read) => {
  expect((await get(request(name, false))).status).toBe(401); expect(read).not.toHaveBeenCalled();
  for (const query of ['?days=14', '?days=7&days=30', '?product=quiz-arena', '?path=/']) expect((await get(request(name + query))).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
  vi.mocked(read).mockResolvedValue({ days: 30 } as never);
  const response = await get(request(name + '?days=30'));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(read).toHaveBeenCalledExactlyOnceWith(30);
  vi.mocked(read).mockRejectedValue(new Error('private failure'));
  const error = await get(request(name)); expect(error.status).toBe(503); expect(await error.text()).not.toContain('private failure');
});
it('session drilldown accepts a strict selection and rejects arbitrary/duplicate fields', async () => {
  const selection = { kind: 'traffic', referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: 'test' };
  vi.mocked(service.readAnalyticsSessions).mockResolvedValue({} as never);
  expect((await sessions(request('sessions?' + new URLSearchParams({ days: '30', selection: JSON.stringify(selection) })))).status).toBe(200);
  expect(service.readAnalyticsSessions).toHaveBeenCalledWith(expect.objectContaining({ days: 30, selection }));
  for (const value of ['{}', '{', JSON.stringify({ ...selection, sql: 'anything' })]) expect((await sessions(request('sessions?' + new URLSearchParams({ selection: value })))).status).toBe(400);
});
