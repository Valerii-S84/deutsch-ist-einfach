import type { PublicAnalyticsEventName, PublicAnalyticsPayload } from "../analytics";
import { z } from "zod";
import { analyticsEventSchema, analyticsId, normalizeAnalyticsPath, type AnalyticsEvent, type AnalyticsFormId, type ContactAnalyticsContext } from "./contract";
import { AnalyticsIdentity, isCurrentVisitor, QUIZ_KEY, SESSION_TIMEOUT } from "./identity";
import { AnalyticsTransport } from "./transport";
import { analyticsElement } from "./elements";
import { PageObservations } from "./observations";

const placements = new Set(["header", "header_mobile", "hero", "channel", "product_card", "quiz_teaser", "article_kurzantwort"]);
export function telegramClick(name: PublicAnalyticsEventName, payload: PublicAnalyticsPayload) {
  const telegram = name === "channel_cta_click" || (name === "hero_cta_click" && ["telegram_bot", "deutsch_trainer"].includes(String(payload.cta))) || (name === "quiz_teaser_cta_clicked" && payload.destination === "telegram_bot");
  if (!telegram) return null;
  return {
    element_id: name === "channel_cta_click" ? "telegram_channel" : payload.cta === "deutsch_trainer" ? "deutsch_trainer" : "telegram_bot",
    placement: typeof payload.section === "string" && placements.has(payload.section) ? payload.section : "unknown",
    destination: "telegram" as const,
  };
}

export const PUBLIC_EVENT_DECISIONS: Record<PublicAnalyticsEventName, string> = {
  hero_cta_click: "element_click", channel_cta_click: "element_click", quiz_teaser_cta_clicked: "element_click",
  wizard_open: "form_open", form_error: "form_error", quiz_teaser_started: "quiz_started",
  quiz_teaser_completed: "quiz_completed", quiz_teaser_error: "frontend_error",
  quiz_teaser_question_answered: "outside_v1", lead_submit_success: "server_only_form_success",
};
const quizStateSchema = z.object({ visitor: analyticsId, run: analyticsId, key: z.string().regex(/^(curated|api):\d{1,6}$/), completed: z.boolean() }).strict();

export class WebsiteAnalytics {
  private identity: AnalyticsIdentity;
  private transport: AnalyticsTransport;
  private page: { id: string; path: string; active: number; observations: PageObservations; errors: number } | null = null;
  private path = window.location.pathname;
  private stopped = false;
  private suspended = false;
  private starting: Promise<boolean> | null = null;
  private lastSample = Date.now();
  private lastInput = Date.now();
  private active = false;
  private visitor: string | null = null;
  private listeners: Array<() => void> = [];
  private timer?: ReturnType<typeof setInterval>;
  private forms = new Map<AnalyticsFormId, { id: string; visitor: string; attempt?: string }>();

  constructor(private allowed: () => boolean, private collectionBasis: () => "granted" | "automatic" = () => "granted") {
    this.identity = new AnalyticsIdentity(allowed);
    this.transport = new AnalyticsTransport(() => !this.stopped && allowed() && isCurrentVisitor(this.visitor));
  }

  start() {
    const listen = (target: Window | Document, event: string, handler: EventListener, capture = false) => {
      target.addEventListener(event, handler, { passive: true, capture });
      this.listeners.push(() => target.removeEventListener(event, handler, capture));
    };
    const activity = () => {
      if (!this.allowed() || document.visibilityState === "hidden" || !document.hasFocus()) return;
      this.sample();
      this.lastInput = Date.now();
      void this.ensure().then(ready => {
        if (!ready || this.stopped || !this.allowed()) return;
        this.identity.session!.lastActivity = Date.now();
        try { this.identity.save(); } catch { this.stop(); }
        this.active = true;
      });
    };
    for (const event of ["pointerdown", "keydown", "scroll"]) listen(window, event, activity);
    listen(window, "focus", activity);
    listen(window, "blur", () => { this.sample(); this.active = false; this.page?.observations.pause(); });
    listen(document, "visibilitychange", () => {
      this.sample();
      this.active = document.visibilityState === "visible" && document.hasFocus();
      if (document.visibilityState === "hidden") { this.page?.observations.pause(); this.transport.lastAttempt(); }
      else if (!this.page) void this.ensure();
    });
    listen(window, "pagehide", () => {
      this.sample();
      this.leave("pagehide");
      this.transport.lastAttempt();
      this.suspended = true;
      this.active = false;
      this.identity.stop(); // Release the lock for BFCache/reload.
    });
    listen(window, "pageshow", event => {
      if (!(event as PageTransitionEvent).persisted) return;
      this.path = window.location.pathname;
      this.suspended = false;
      void this.ensure();
    });
    const click = (event: Event) => {
      if (event.type === "auxclick" && (event as MouseEvent).button !== 1) return;
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics-id]") : null;
      if (!element || element.dataset.analyticsExplicit === "true") return;
      const label = analyticsElement(element.dataset.analyticsId, element.dataset.analyticsPlacement);
      if (label) this.action(() => { this.emit("element_click", label); void this.transport.flush(); });
    };
    listen(document, "click", click, true);
    listen(document, "auxclick", click, true);
    listen(window, "error", event => { if (event instanceof ErrorEvent) this.frontendError("js_error", "app"); });
    listen(window, "unhandledrejection", () => this.frontendError("unhandled_rejection", "app"));
    this.timer = setInterval(() => {
      if (this.stopped || this.suspended || !this.allowed() || !this.identity.currentVisitor()) return;
      this.sample();
      this.page?.observations.sample(this.page.active);
    }, 250);
    if (document.visibilityState !== "hidden") void this.ensure();
  }

  private async ensure(): Promise<boolean> {
    if (this.stopped || this.suspended || !this.allowed() || document.visibilityState === "hidden") return false;
    if (this.starting) return this.starting;
    const session = this.identity.session;
    if (session && this.identity.currentVisitor() && Date.now() - session.lastActivity < SESSION_TIMEOUT) return true;
    this.sample();
    if (session && !this.identity.currentVisitor()) {
      this.transport.stop();
      this.transport = new AnalyticsTransport(() => !this.stopped && this.allowed() && isCurrentVisitor(this.visitor));
      this.page = null;
    } else if (this.page) this.leave("navigation");
    this.identity.stop();
    this.identity = new AnalyticsIdentity(this.allowed);
    this.starting = this.identity.initialize().then(ready => {
      if (!ready || this.stopped || !this.allowed()) return false;
      this.openPage();
      return true;
    }).catch(() => { this.stop(); return false; }).finally(() => { this.starting = null; });
    return this.starting;
  }

  private openPage() {
    this.visitor = this.identity.session!.visitor;
    this.page = { id: crypto.randomUUID(), path: normalizeAnalyticsPath(this.path), active: 0, observations: new PageObservations((name, metadata) => this.emit(name, metadata)), errors: 0 };
    this.lastSample = this.lastInput = Date.now();
    this.active = document.visibilityState === "visible" && document.hasFocus();
    if (this.identity.session!.sequence === 0) this.emit("session_start", { entry_path: this.identity.session!.traffic.entry_path });
    this.emit("page_view", {});
    if (this.stopped || !this.identity.session) return;
    this.identity.session.lastActivity = Date.now();
    try { this.identity.save(); } catch { this.stop(); }
  }

  navigate(path: string) {
    if (this.path === path) return;
    this.path = path;
    if (this.stopped || !this.allowed() || !this.page) return;
    this.sample();
    this.leave("navigation");
    void this.ensure().then(ready => {
      if (ready && !this.stopped && this.allowed() && !this.page) this.openPage();
    });
  }

  track(name: PublicAnalyticsEventName, payload: PublicAnalyticsPayload) {
    if (name === "lead_submit_success" || name === "quiz_teaser_question_answered") return;
    this.action(() => {
      if (["hero_cta_click", "channel_cta_click", "quiz_teaser_cta_clicked"].includes(name)) {
        const id = name === "channel_cta_click" ? "telegram_channel" : name === "quiz_teaser_cta_clicked" ? "telegram_bot" : payload.cta;
        const click = analyticsElement(id, payload.section);
        if (click) { this.emit("element_click", click); void this.transport.flush(); }
      } else if (name === "wizard_open") {
        const form = payload.wizard_type;
        if (form !== "student" && form !== "partner") return;
        const instance = { id: crypto.randomUUID(), visitor: this.visitor! };
        this.forms.set(form, instance);
        this.emit("form_open", { form_id: form, form_instance_id: instance.id });
      } else if (name === "form_error") {
        const form = payload.form_id;
        if (form !== "student" && form !== "partner") return;
        const instance = this.formInstance(form);
        if (payload.submission_attempt_id && (payload.submission_attempt_id !== instance.attempt || payload.form_instance_id !== instance.id)) return;
        this.emit("form_error", { form_id: form, form_instance_id: instance.id, ...(payload.submission_attempt_id ? { submission_attempt_id: payload.submission_attempt_id } : {}), error_code: payload.error_code });
        void this.transport.flush();
      } else if (name === "quiz_teaser_error") this.emitFrontendError(payload.error_code, "quiz");
      else if (name === "quiz_teaser_started" || name === "quiz_teaser_completed") this.quiz(name, payload);
    });
  }

  private action(callback: () => void) {
    if (!this.allowed() || this.stopped) return;
    if (this.page && !this.suspended && this.identity.currentVisitor() && this.identity.session && Date.now() - this.identity.session.lastActivity < SESSION_TIMEOUT) {
      this.sample(); this.lastInput = Date.now(); this.identity.session.lastActivity = Date.now();
      try { callback(); } catch { this.stop(); }
      return;
    }
    void this.ensure().then(ready => {
      if (!ready || !this.page || !this.allowed() || this.stopped) return;
      this.sample();
      this.lastInput = Date.now();
      this.identity.session!.lastActivity = Date.now();
      callback();
    }).catch(() => { this.stop(); });
  }

  private formInstance(form: AnalyticsFormId) {
    let instance = this.forms.get(form);
    if (!instance || instance.visitor !== this.visitor) {
      instance = { id: crypto.randomUUID(), visitor: this.visitor! };
      this.forms.set(form, instance);
    }
    return instance;
  }

  async prepareFormSubmission(form: AnalyticsFormId): Promise<ContactAnalyticsContext | undefined> {
    // The form can proceed if tracking cannot become ready promptly.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const ready = await Promise.race([this.ensure(), new Promise<false>(resolve => { timeout = setTimeout(() => resolve(false), 100); })]);
      if (!ready || !this.page || !this.allowed() || this.stopped || !this.identity.session) return;
      const instance = this.formInstance(form);
      instance.attempt = crypto.randomUUID();
      const session = this.identity.session;
      const context: ContactAnalyticsContext = {
        consent: this.collectionBasis(), schema_version: 1, visitor_id: session.visitor, session_id: session.id,
        page_view_id: this.page.id, path: this.page.path, ...session.traffic,
        form_id: form, form_instance_id: instance.id, submission_attempt_id: instance.attempt,
      };
      this.emit("form_submit", { form_id: form, form_instance_id: instance.id, submission_attempt_id: instance.attempt });
      void this.transport.flush();
      return this.allowed() && !this.stopped ? context : undefined;
    } catch { return undefined; }
    finally { clearTimeout(timeout); }
  }

  private quiz(name: "quiz_teaser_started" | "quiz_teaser_completed", payload: PublicAnalyticsPayload) {
    if (!["curated", "api"].includes(String(payload.quiz_source)) || !Number.isInteger(payload.day_number) || Number(payload.day_number) < 1 || Number(payload.day_number) > 999999) return;
    const key = `${payload.quiz_source}:${payload.day_number}`;
    let saved: z.infer<typeof quizStateSchema> | undefined;
    try {
      const parsed = quizStateSchema.safeParse(JSON.parse(sessionStorage.getItem(QUIZ_KEY) ?? "null"));
      if (parsed.success && parsed.data.visitor === this.visitor && parsed.data.key === key) saved = parsed.data;
    } catch { return; }
    if (name === "quiz_teaser_started") {
      if (saved) return; // Resume/reload is the same observed run.
      saved = { visitor: this.visitor!, key, run: crypto.randomUUID(), completed: false };
      this.emit("quiz_started", { quiz_id: "daily_quiz", quiz_run_id: saved.run });
    } else {
      // A run begun before consent is not reconstructed from stored game progress.
      if (!saved || saved.completed || payload.question_index !== 5 || !Number.isInteger(payload.score) || Number(payload.score) < 0 || Number(payload.score) > 5) return;
      saved.completed = true;
      this.emit("quiz_completed", { quiz_id: "daily_quiz", quiz_run_id: saved.run, answered_count: 5, correct_count: payload.score });
    }
    try { sessionStorage.setItem(QUIZ_KEY, JSON.stringify(saved)); } catch { this.stop(); }
    void this.transport.flush();
  }

  private frontendError(code: string, component: string) { this.action(() => this.emitFrontendError(code, component)); }
  private emitFrontendError(code: unknown, component: string) {
    if (!this.page || this.page.errors >= 5) return;
    this.page.errors++;
    this.emit("frontend_error", { error_code: typeof code === "string" ? code : "unknown_error", component_id: component });
    void this.transport.flush();
  }

  private sample() {
    const now = Date.now();
    if (this.page && this.active) this.page.active = Math.min(86_400_000, this.page.active + Math.max(0, Math.min(now, this.lastInput + 60_000) - this.lastSample));
    this.lastSample = now;
  }

  private leave(reason: "navigation" | "pagehide") {
    if (!this.page) return;
    this.emit("page_leave", { reason, active_ms: Math.round(this.page.active), scroll_percent: this.page.observations.scroll });
    this.page = null;
  }

  private emit(name: AnalyticsEvent["event_name"], metadata: Record<string, unknown>) {
    const session = this.identity.session;
    if (!session || !this.page || !this.allowed() || this.stopped) return;
    const parsed = analyticsEventSchema.safeParse({
      product_id: "deutschmit", schema_version: 1, event_id: crypto.randomUUID(),
      visitor_id: session.visitor, session_id: session.id, page_view_id: this.page.id,
      sequence: ++session.sequence, occurred_at: new Date().toISOString(), path: this.page.path,
      event_name: name, metadata: { ...session.traffic, ...metadata },
    });
    if (!parsed.success) return;
    try { this.identity.save(); } catch { this.stop(); return; }
    this.transport.enqueue(parsed.data);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.forms.clear();
    this.transport.stop();
    this.identity.stop();
    this.page = null;
    for (const remove of this.listeners) remove();
    this.listeners = [];
  }
}
