"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_CONSENT_STORAGE_KEY, WEBSITE_CONSENT_STORAGE_KEY, PUBLIC_VISITOR_ID_STORAGE_KEY, PUBLIC_VISITOR_AGE_STORAGE_KEY, getAnalyticsMode, type AnalyticsConsent, type AnalyticsMode, type PublicAnalyticsEventName, type PublicAnalyticsPayload } from "@/lib/analytics";
import { WebsiteAnalytics, telegramClick } from "@/lib/analytics/browser";
import { clearAnalyticsIdentity } from "@/lib/analytics/identity";
import { sendWebsiteAnalyticsEvent } from "@/lib/public-analytics-client";
import type { AnalyticsFormId, ContactAnalyticsContext } from "@/lib/analytics/contract";

const AnalyticsContext = createContext({
  consent: "pending" as AnalyticsConsent,
  requestConsent: (_allowed: boolean) => {},
  openSettings: () => {},
  trackEvent: (_name: PublicAnalyticsEventName, _payload?: PublicAnalyticsPayload) => {},
  prepareFormSubmission: async (_form: AnalyticsFormId): Promise<ContactAnalyticsContext | undefined> => undefined,
});
export function usePublicAnalytics() { return useContext(AnalyticsContext); }

function readConsent(key: string): AnalyticsConsent {
  try {
    const value = localStorage.getItem(key);
    return value === "granted" || value === "denied" ? value : "pending";
  } catch { return "pending"; }
}

export function AnalyticsProvider({ children, mode = getAnalyticsMode() }: { children: ReactNode; mode?: AnalyticsMode }) {
  const pathname = usePathname();
  const publicScope = !pathname?.startsWith("/admin");
  const key = mode === "new" ? WEBSITE_CONSENT_STORAGE_KEY : ANALYTICS_CONSENT_STORAGE_KEY;
  const [consent, setConsent] = useState<AnalyticsConsent>("pending");
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState(false);
  const tracker = useRef<WebsiteAnalytics | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const current = useRef<AnalyticsConsent>("pending");
  const lastLegacyPath = useRef<string | null>(null);

  const applyConsent = useCallback((value: AnalyticsConsent) => {
    if (value !== "granted") {
      tracker.current?.stop(); tracker.current = null;
      clearAnalyticsIdentity();
      try { localStorage.removeItem(PUBLIC_VISITOR_ID_STORAGE_KEY); } catch {}
      try { localStorage.removeItem(PUBLIC_VISITOR_AGE_STORAGE_KEY); } catch {}
      lastLegacyPath.current = null;
    }
    current.current = value;
    setConsent(value);
  }, []);

  useEffect(() => {
    applyConsent(readConsent(key));
    setLoaded(true);
    const sync = () => applyConsent(readConsent(key));
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) sync(); };
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    try {
      const broadcast = new BroadcastChannel("deutschmit-analytics-consent");
      channel.current = broadcast;
      broadcast.onmessage = event => {
        if (event.data?.key === key && ["granted", "denied"].includes(event.data?.value)) sync();
      };
    } catch {}
    return () => {
      window.removeEventListener("storage", storage); window.removeEventListener("pageshow", sync); window.removeEventListener("focus", sync);
      channel.current?.close(); channel.current = null;
    };
  }, [key, applyConsent]);

  const requestConsent = useCallback((allowed: boolean) => {
    const value = allowed ? "granted" : "denied";
    try {
      localStorage.setItem(key, value);
      if (!allowed) localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    } catch {}
    applyConsent(value);
    channel.current?.postMessage({ key, value });
    setSettings(false);
  }, [key, applyConsent]);

  useEffect(() => {
    if (!loaded || !publicScope || consent !== "granted" || mode !== "new") return;
    const runtime = new WebsiteAnalytics(() => current.current === "granted" && readConsent(key) === "granted" && !window.location.pathname.startsWith("/admin"));
    tracker.current = runtime;
    runtime.start();
    return () => { runtime.stop(); if (tracker.current === runtime) tracker.current = null; };
  }, [loaded, publicScope, consent, mode, key]);

  useEffect(() => {
    if (!publicScope || !loaded || consent !== "granted" || !pathname) return;
    if (mode === "new") tracker.current?.navigate(pathname);
    if (mode === "legacy" && lastLegacyPath.current !== pathname && readConsent(key) === "granted") {
      lastLegacyPath.current = pathname;
      sendWebsiteAnalyticsEvent({ eventType: "page_view", path: pathname });
    }
  }, [pathname, publicScope, loaded, consent, mode, key]);

  const trackEvent = useCallback((name: PublicAnalyticsEventName, payload: PublicAnalyticsPayload = {}) => {
    if (!publicScope || current.current !== "granted" || readConsent(key) !== "granted") return;
    if (mode === "new") tracker.current?.track(name, payload);
    const click = telegramClick(name, payload);
    if (mode === "legacy" && click) sendWebsiteAnalyticsEvent({ eventType: "telegram_cta_click", metadata: { public_event_name: name, section: click.placement, cta: click.element_id, destination: click.destination } });
  }, [publicScope, mode, key]);
  const prepareFormSubmission = useCallback(async (form: AnalyticsFormId) => {
    if (mode !== "new" || !publicScope || current.current !== "granted" || readConsent(key) !== "granted") return;
    return tracker.current?.prepareFormSubmission(form);
  }, [mode, publicScope, key]);
  const value = useMemo(() => ({ consent, requestConsent, trackEvent, prepareFormSubmission, openSettings: () => setSettings(true) }), [consent, requestConsent, trackEvent, prepareFormSubmission]);

  return <AnalyticsContext.Provider value={value}>
    {children}
    {publicScope && loaded && (settings || (consent === "pending" && mode !== "off")) ? <section
      className="fixed inset-x-0 bottom-0 z-[80] bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.18)]"
      role="dialog" aria-live="polite" aria-label="Datenschutz und Analytics-Einwilligung"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-800">Nur mit deiner Einwilligung messen wir Seitenaufrufe, wichtige Klicks, ungefähre aktive Zeit sowie Quiz- und Anfrageergebnisse, ohne Formularinhalte. Du kannst deine Entscheidung hier jederzeit ändern. <a href="/privacy" className="underline">Datenschutz</a></p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => requestConsent(true)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Analytics erlauben</button>
          <button type="button" onClick={() => requestConsent(false)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold">{consent === "granted" ? "Einwilligung widerrufen" : "Analytics ablehnen"}</button>
          {settings ? <button type="button" onClick={() => setSettings(false)} className="rounded-full border border-slate-300 px-4 py-2 text-xs">Schließen</button> : null}
        </div>
      </div>
    </section> : null}
  </AnalyticsContext.Provider>;
}
