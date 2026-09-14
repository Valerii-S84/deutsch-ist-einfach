import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationReportPage, ReportTables, reportRatio, sessionsHref } from "./application-report";
import SessionsPage from "./sessions/page";
import { DeutschmitNavigation } from "./analytics-ui";
import { fetchDeutschmitReport, fetchDeutschmitSessions } from "@/lib/deutschmit-analytics-client";
import { parseReportSelection } from "@/lib/analytics/report-selection";
import type { ApplicationReport, ApplicationReportName } from "@/lib/analytics/application-report-contract";
vi.mock('@/lib/deutschmit-analytics-client', () => ({ fetchDeutschmitReport: vi.fn(), fetchDeutschmitSessions: vi.fn() }));
const navigation = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
afterEach(() => { vi.resetAllMocks(); navigation.query = ''; });
function fixture(name: ApplicationReportName, days: 7 | 30, value: number): ApplicationReport {
  const meta = { product_id: 'deutschmit', days, generated_at: new Date().toISOString(), last_received_at: new Date().toISOString(), history_available_from: new Date().toISOString(), period_start: '2026-09-01T00:00:00Z' };
  const bodies = {
    pages: { items: [{ path: '/wissen', page_views: value, visitors: 1, measured_views: 1, average_active_ms: 60000, max_scroll: null, article_reads: 1 }] },
    events: { events: [{ event_name: 'page_view', count: value }], elements: [{ element_id: 'cta', placement: 'hero', impressions: 0, clicks: 1, matched_click_views: 0, unmatched_clicks: 1 }], errors: [{ error_code: 'unknown_error', component_id: 'app', count: 1 }] },
    traffic: { items: [{ source_kind: 'direct', referrer_host: null, utm_source: null, utm_medium: null, utm_campaign: null, sessions: value, converted_sessions: 1, analytics_conversions: 1 }] },
    conversions: { forms: [{ form_id: 'student', opens: value, submits: 2, successes: 1, errors: 0 }], quizzes: [{ quiz_id: 'daily', starts: 1, completions: 1 }], intents: [{ destination: 'telegram', clicks: 1 }] },
  };
  return { ...meta, ...bodies[name] } as ApplicationReport;
}
it.each(['pages', 'events', 'traffic', 'conversions'] as const)('%s links use typed selectors and retain days; old and cached filter data stay hidden', async name => {
  const markup = renderToStaticMarkup(<ReportTables name={name} data={fixture(name, 30, 789)} />);
  const holder = document.createElement('div'); holder.innerHTML = markup;
  const links = [...holder.querySelectorAll('a')]; expect(links.length).toBeGreaterThan(0);
  for (const link of links) { const url = new URL(link.href); expect(url.pathname).toBe('/admin/deutschmit/sessions'); expect(url.searchParams.get('days')).toBe('30'); expect(parseReportSelection(url.searchParams.get('selection'))).toBeTruthy(); }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(['deutschmit-analytics', name, 30], fixture(name, 30, 678));
  let finish: (data: ApplicationReport) => void = () => {};
  vi.mocked(fetchDeutschmitReport).mockResolvedValueOnce(fixture(name, 7, 789)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error('unavailable'));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><ApplicationReportPage name={name} /></QueryClientProvider>));
    await vi.waitFor(() => expect(container.textContent).toContain('789'));
    await act(async () => { const select = container.querySelector('select')!; select.value = '30'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.textContent).not.toContain('789'); expect(container.textContent).not.toContain('678');
    await act(async () => finish(fixture(name, 30, 890)));
    await vi.waitFor(() => expect(container.textContent).toContain('890'));
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Оновити')!.click(); });
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull()); expect(container.textContent).not.toContain('890');
  } finally { act(() => root.unmount()); client.clear(); container.remove(); }
});
it('hydrates a report link into the same Sessions request', async () => {
  const selection = { kind: 'intent', destination: 'amazon' } as const;
  navigation.query = sessionsHref(30, selection).split('?')[1];
  vi.mocked(fetchDeutschmitSessions).mockImplementation(() => new Promise(() => {}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const container = document.createElement('div'); const root = createRoot(container);
  try { await act(async () => root.render(<QueryClientProvider client={client}><SessionsPage /></QueryClientProvider>));
    expect(fetchDeutschmitSessions).toHaveBeenCalledWith(expect.objectContaining({ days: 30, selection })); expect(container.textContent).toContain('Amazon');
  } finally { act(() => root.unmount()); client.clear(); }
});
it('preserves six reports, legacy and requests; renders explicit ratio denominators', () => {
  const markup = renderToStaticMarkup(<DeutschmitNavigation active="pages" />);
  for (const path of ['overview', 'sessions', 'pages', 'events', 'traffic', 'conversions', 'requests']) expect(markup).toContain(`/admin/deutschmit/${path}`);
  expect(markup).toContain('/admin/dashboard'); expect(reportRatio(0, 0)).toBe('0 / 0 · Не визначено'); expect(reportRatio(1, 3)).toBe('1 / 3 · 33,3 %');
});
