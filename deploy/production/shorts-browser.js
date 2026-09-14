/* shorts-website-analytics:start */
(() => {
  if (window.__shortsAnalyticsInstalled) return;
  window.__shortsAnalyticsInstalled = true;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === "1") return;
  const paths = { "/": "/", "/index.html": "/", "/privacy": "/privacy/", "/privacy/": "/privacy/", "/privacy/index.html": "/privacy/", "/support": "/support/", "/support/": "/support/", "/support/index.html": "/support/", "/terms": "/terms/", "/terms/": "/terms/", "/terms/index.html": "/terms/" };
  const path = paths[location.pathname];
  if (!path || !crypto.randomUUID) return;
  const uuid = () => crypto.randomUUID();
  const read = (storage, key) => { try { return JSON.parse(window[storage].getItem(key)); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, JSON.stringify(value)); } catch { /* Memory-only identity. */ } };
  const now = Date.now();
  let visitor = read("localStorage", "sbk_analytics_visitor");
  if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor.id) || !Number.isFinite(visitor.created) || visitor.created > now || now - visitor.created >= 90 * 86400000) visitor = { id: uuid(), created: now };
  write("localStorage", "sbk_analytics_visitor", visitor);
  let session = read("sessionStorage", "sbk_analytics_session");
  const externalHost = () => { try { const ref = new URL(document.referrer); return [location.hostname, "shortsblockerkids.de", "www.shortsblockerkids.de"].includes(ref.hostname) || !/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(ref.hostname) ? null : ref.hostname; } catch { return null; } };
  function identity() {
    if (!session || !/^[0-9a-f-]{36}$/i.test(session.id) || !Number.isFinite(session.last) || Date.now() - session.last >= 1800000) session = { id: uuid(), last: Date.now(), sequence: 0, referrer: externalHost() };
    session.last = Date.now(); session.sequence = (Number.isSafeInteger(session.sequence) ? session.sequence : 0) + 1;
    write("sessionStorage", "sbk_analytics_session", session);
  }
  const device = /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
  let pageView = uuid(), started = false, active = 0, since = null, lastActivity = Date.now();
  function event(name, element = null, duration = null) {
    identity();
    const body = JSON.stringify({ events: [{ event_id: uuid(), visitor_id: visitor.id, session_id: session.id, page_view_id: pageView, event_name: name, occurred_at: new Date().toISOString(), sequence: session.sequence, path, element_id: element, active_ms: duration, referrer_host: session.referrer, device, is_test: read("sessionStorage", "sbk_analytics_test") === true }] });
    const send = () => fetch("/api/website-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }).then(response => { if (!response.ok) throw new Error("delivery_failed"); });
    void send().catch(() => { setTimeout(() => { void send().catch(() => {}); }, 1000); });
  }
  function accrue() {
    const end = Math.min(Date.now(), lastActivity + 60000);
    if (since !== null) active += Math.max(0, end - since);
    since = document.visibilityState === "visible" && document.hasFocus() ? Date.now() : null;
  }
  function start() {
    if (started || document.visibilityState !== "visible") return;
    started = true; event("page_view"); accrue();
  }
  document.addEventListener("click", click => {
    const target = click.target instanceof Element ? click.target.closest("a,button") : null;
    if (!target) return;
    let element = null;
    if (target.matches("a[href]")) {
      const url = new URL(target.getAttribute("href"), location.href);
      if (url.protocol === "mailto:") element = "email";
      else if (url.origin === location.origin) element = ({ "/": "home", "/privacy/": "privacy", "/support/": "support", "/terms/": "terms" })[paths[url.pathname]] ?? null;
    } else element = target.classList.contains("mock-primary") ? "preview_primary" : target.classList.contains("mock-secondary") ? "preview_secondary" : "preview_button";
    if (element) { start(); event("element_click", element); }
  }, true);
  for (const name of ["pointerdown", "keydown", "scroll"]) document.addEventListener(name, () => { accrue(); lastActivity = Date.now(); }, { passive: true });
  document.addEventListener("visibilitychange", () => { accrue(); start(); if (started && document.visibilityState === "hidden") event("page_leave", null, Math.min(86400000, Math.round(active))); });
  window.addEventListener("blur", accrue);
  window.addEventListener("focus", () => { lastActivity = Date.now(); accrue(); });
  window.addEventListener("pagehide", () => { accrue(); if (started) event("page_leave", null, Math.min(86400000, Math.round(active))); });
  window.addEventListener("pageshow", e => { if (e.persisted) { pageView = uuid(); started = false; active = 0; since = null; start(); } });
  start();
})();
/* shorts-website-analytics:end */
