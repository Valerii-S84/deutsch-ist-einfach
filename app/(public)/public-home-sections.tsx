import Image from "next/image";
import Link from "next/link";
import { analyticsAttributes } from "@/lib/analytics/elements";
import { AnalyticsSettingsButton } from "@/app/analytics-settings-button";

import {
  PUBLIC_SITE_NAME,
  QUIZ_PRODUCT_NAME,
  TELEGRAM_BOT_START_PAYLOAD,
  getDeutschTrainerBotUrl,
  getTelegramBotUrl,
  getTelegramChannelUrl,
} from "@/lib/public-site-config";

import {
  BOT_LOGO_PATH,
  CHANNEL_LOGO_PATH,
  DEUTSCH_TRAINER_LOGO_PATH,
  GLASS_CARD_CLASS,
  ORANGE_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  WISSEN_ARTICLES,
  WORKLOG_DOWNLOAD_PATH,
  WORKLOG_LOGO_PATH,
} from "./public-home-content";
import { PublicHomeQuizTeaserWidget } from "./_components/quiz-teaser-widget";
import { buildTrackedTelegramBotUrl, formatStatValue } from "./public-home-helpers";
import type { StatsState } from "./public-home-types";

type PublicHomeHeroProps = {
  trackedTelegramBotUrl: string;
};

type PublicHomeStatsSectionProps = {
  stats: StatsState;
};

type PublicHomeQuizTeaserSectionProps = {
  trackedTelegramBotUrl: string;
};

type PublicHomeProductsSectionProps = {
  trackedTelegramBotUrl?: string;
};

type PublicHomeContactSectionProps = {
  onOpenStudentWizard?: () => void;
  onOpenPartnerWizard?: () => void;
};

type PublicHomeFooterProps = {
  trackedTelegramBotUrl?: string;
};

type ProductCard = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  actionLabel: string;
  imageSrc?: string;
  imageAlt?: string;
  download?: string;
  analyticsEventName?: "hero_cta_click" | "channel_cta_click";
  analyticsSection?: string;
  analyticsCta?: string;
};

const LINK_FOCUS_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f]";

function getTrackedTelegramBotFallback(): string {
  return buildTrackedTelegramBotUrl(getTelegramBotUrl(), TELEGRAM_BOT_START_PAYLOAD);
}

function opensInNewTab(href: string, download?: string): boolean {
  if (download) {
    return false;
  }

  return href.startsWith("http://") || href.startsWith("https://");
}

function getProjectCards(trackedTelegramBotUrl: string): ProductCard[] {
  return [
    {
      title: QUIZ_PRODUCT_NAME,
      eyebrow: "Telegram Quiz Bot",
      description: "Tägliche Quizrunden, Duelle, Streaks und Fortschritt direkt in Telegram.",
      href: trackedTelegramBotUrl,
      actionLabel: "Bot öffnen",
      imageSrc: BOT_LOGO_PATH,
      imageAlt: `${QUIZ_PRODUCT_NAME} Logo`,
      analyticsEventName: "hero_cta_click",
      analyticsSection: "product_card",
      analyticsCta: "telegram_bot",
    },
    {
      title: "Deutsch ist einfach!",
      eyebrow: "Telegram-Kanal",
      description: "Kurze Lernposts, Redemittel, Mini-Übungen und Impulse für den Alltag.",
      href: getTelegramChannelUrl(),
      actionLabel: "Kanal öffnen",
      imageSrc: CHANNEL_LOGO_PATH,
      imageAlt: "Deutsch ist einfach! Kanal Logo",
      analyticsEventName: "channel_cta_click",
      analyticsSection: "product_card",
      analyticsCta: "telegram_channel",
    },
    {
      title: "Deutsch Trainer Bot",
      eyebrow: "Persönliches Training",
      description:
        "Kurze Deutsch-Quizsessions mit Fortschritt, Wiederholungen und direktem Feedback.",
      href: getDeutschTrainerBotUrl(),
      actionLabel: "Trainer öffnen",
      imageSrc: DEUTSCH_TRAINER_LOGO_PATH,
      imageAlt: "Deutsch Trainer Bot Logo",
      analyticsEventName: "hero_cta_click",
      analyticsSection: "product_card",
      analyticsCta: "deutsch_trainer",
    },
  ];
}

function ProductIcon({ product }: { product: ProductCard }) {
  if (product.imageSrc && product.imageAlt) {
    return (
      <span
        aria-hidden="true"
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:h-11 sm:w-11"
      >
        <Image
          src={product.imageSrc}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#FFD166]/30 bg-[#FFD166]/10 text-sm font-bold text-[#FFD166] sm:h-11 sm:w-11"
    >
      {product.title.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ProjectCard({ product }: { product: ProductCard }) {
  const shouldOpenInNewTab = opensInNewTab(product.href, product.download);

  return (
    <article className={`${GLASS_CARD_CLASS} flex h-full min-w-0 flex-col overflow-hidden`}>
      <div className="relative aspect-[16/9] overflow-hidden border-b border-white/10 bg-[#07111f] p-6 sm:p-8">
        {product.imageSrc ? (
          <Image
            src={product.imageSrc}
            alt=""
            fill
            sizes="(min-width: 1024px) 352px, (min-width: 640px) calc(50vw - 2rem), calc(100vw - 2rem)"
            className="object-contain p-6 sm:p-8"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <p className="w-fit rounded-full border border-[#4DE2C6]/25 bg-[#4DE2C6]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#B9FFF2]">
          {product.eyebrow}
        </p>
        <h3 className="mt-4 break-words text-xl font-semibold leading-tight text-white sm:text-2xl">
          {product.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">{product.description}</p>
        <a
          href={product.href}
          {...(product.analyticsCta ? analyticsAttributes(product.analyticsCta, "product_card", true) : {})}
          target={shouldOpenInNewTab ? "_blank" : undefined}
          rel={shouldOpenInNewTab ? "noreferrer" : undefined}
          download={product.download}
          aria-label={`${product.actionLabel}: ${product.title}`}
          data-analytics-event={product.analyticsEventName}
          data-analytics-section={product.analyticsSection}
          data-analytics-cta={product.analyticsCta}
          className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-4 py-2 text-center text-sm font-semibold leading-snug text-white transition hover:border-[#2AABEE]/70 hover:bg-[#2AABEE]/20 ${LINK_FOCUS_CLASS} sm:w-fit`}
        >
          {product.actionLabel}
        </a>
      </div>
    </article>
  );
}

export function PublicHomeHero({ trackedTelegramBotUrl }: PublicHomeHeroProps) {
  return (
    <section
      id="hero"
      className="grid min-w-0 gap-6 py-8 sm:gap-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-20"
    >
      <div className="flex min-w-0 flex-col justify-center">
        <p className="inline-flex max-w-full rounded-full border border-[#4DE2C6]/25 bg-[#4DE2C6]/10 px-3 py-1 text-xs font-semibold uppercase leading-snug text-[#4DE2C6]">
          Deutsch lernen mit System
        </p>
        <h1 className="mt-5 max-w-4xl break-words text-[2rem] font-semibold leading-[1.08] text-white sm:text-5xl sm:leading-tight lg:text-6xl">
          Deutsch lernen. Wissen testen. Jeden Tag Fortschritte machen.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
          Finde in fünf kurzen Fragen heraus, wo du stehst. Du bekommst sofort ein Ergebnis und
          kannst danach mit passenden Quizrunden, Lernimpulsen und Erklärungen weiterlernen.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="#quiz-teaser"
            className={`w-full sm:w-auto ${ORANGE_BUTTON_CLASS}`}
            data-analytics-event="hero_cta_click"
            data-analytics-section="hero"
            data-analytics-cta="quiz_teaser_anchor"
            {...analyticsAttributes("quiz_teaser_anchor", "hero", true)}
          >
            Deutsch in 5 Fragen testen
          </a>
          <a
            href={trackedTelegramBotUrl}
            target="_blank"
            rel="noreferrer"
            className={`w-full sm:w-auto ${SECONDARY_BUTTON_CLASS}`}
            data-analytics-event="hero_cta_click"
            data-analytics-section="hero"
            data-analytics-cta="telegram_bot"
            {...analyticsAttributes("telegram_bot", "hero", true)}
          >
            Quiz-Bot auf Telegram öffnen
          </a>
        </div>
      </div>

      <aside className={`${GLASS_CARD_CLASS} min-w-0 p-5 sm:p-7`} aria-label="Dein schneller Einstieg">
        <p className="text-sm font-semibold text-[#FFD166]">Dein schneller Einstieg</p>
        <h2 className="mt-2 break-words text-xl font-semibold leading-tight text-white sm:text-2xl">
          In fünf Fragen zum nächsten Lernschritt.
        </h2>
        <ol className="mt-6 grid gap-4">
          {[
            ["Kurz testen", "Beantworte fünf abwechslungsreiche Deutschfragen."],
            ["Ergebnis sehen", "Erhalte direkt eine klare Rückmeldung zu deiner Runde."],
            ["Passend weiterlernen", "Wähle anschließend das Lernformat, das zu dir passt."],
          ].map(([title, description], index) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 text-sm font-semibold text-[#B9FFF2]"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

export function PublicHomeStatsSection({ stats }: PublicHomeStatsSectionProps) {
  const metricCards = [
    { label: "Nutzer", value: formatStatValue(stats.users) },
    { label: "Gespielte Quizze", value: formatStatValue(stats.quizzes) },
  ];

  return (
    <section id="stats" className="scroll-mt-24 py-5 sm:py-6">
      <div className={`${GLASS_CARD_CLASS} min-w-0 p-4 sm:p-6`}>
        <div className="grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#FFD166]">Community in Zahlen</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Gemeinsam Deutsch lernen
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Aktuelle Zahlen aus Quizrunden und der wachsenden Lerngemeinschaft.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${stats.isUnavailable ? "bg-slate-500" : "bg-[#4DE2C6]"}`}
              />
              {stats.isUnavailable
                ? "Datenabruf derzeit nicht verfügbar"
                : "Bei jedem Seitenaufruf neu geladen"}
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {metricCards.map((metric) => (
              <article
                key={metric.label}
                className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1726] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-5"
              >
                <p className="text-sm font-semibold text-slate-400">{metric.label}</p>
                <p className="mt-2 break-words text-3xl font-semibold text-white sm:text-4xl">
                  {metric.value}
                </p>
                {stats.isUnavailable ? (
                  <p className="mt-2 text-xs text-slate-500">vorübergehend nicht verfügbar</p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicHomeQuizTeaserSection({
  trackedTelegramBotUrl,
}: PublicHomeQuizTeaserSectionProps) {
  return (
    <section id="quiz-teaser" className="scroll-mt-24 py-7 sm:py-8">
      <div
        className={`${GLASS_CARD_CLASS} grid min-w-0 gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.75fr)] lg:items-center`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#FFD166]">Interaktiver Test</p>
          <h2 className="mt-2 max-w-2xl break-words text-2xl font-semibold leading-tight text-white sm:text-4xl">
            Teste dein Deutsch in 5 Fragen.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:leading-8">
            Jeden Tag warten fünf kurze Lernfragen auf dich – von A1 bis B2, mit direkter
            Auswertung und einer verständlichen Erklärung. Entdecke danach noch mehr Übungen im
            Bot und tägliche Lernimpulse in unserem Telegram-Kanal.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3 sm:gap-3">
            {["Sofortige Auswertung", "A1 bis B2", "5 neue Fragen pro Tag"].map((item) => (
              <div
                key={item}
                className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold leading-snug text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <PublicHomeQuizTeaserWidget trackedTelegramBotUrl={trackedTelegramBotUrl} />
      </div>
    </section>
  );
}

export function PublicHomeChannelSection() {
  const telegramChannelUrl = getTelegramChannelUrl();

  return (
    <section id="channel" className="scroll-mt-24 py-6">
      <div
        className={`${GLASS_CARD_CLASS} flex min-w-0 flex-col gap-5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6`}
      >
        <div className="flex min-w-0 items-start gap-4">
          <ProductIcon
            product={{
              title: "Deutsch ist einfach!",
              eyebrow: "Telegram-Kanal",
              description: "",
              href: telegramChannelUrl,
              actionLabel: "Kanal öffnen",
              imageSrc: CHANNEL_LOGO_PATH,
              imageAlt: "Deutsch ist einfach! Kanal Logo",
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#4DE2C6]">Telegram-Kanal</p>
            <h3 className="mt-1 break-words text-lg font-semibold text-white sm:text-xl">
              Deutsch ist einfach!
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Kurze Lernposts, Mini-Übungen, Dialoge und alltagstaugliche Redemittel.
            </p>
          </div>
        </div>
        <a
          href={telegramChannelUrl}
          target="_blank"
          rel="noreferrer"
          className={`w-full sm:w-auto ${ORANGE_BUTTON_CLASS}`}
          data-analytics-event="channel_cta_click"
          data-analytics-section="channel"
          data-analytics-cta="telegram_channel"
          {...analyticsAttributes("telegram_channel", "channel", true)}
        >
          Kanal öffnen
        </a>
      </div>
    </section>
  );
}

export function PublicHomeProductsSection({
  trackedTelegramBotUrl,
}: PublicHomeProductsSectionProps = {}) {
  const productCards = getProjectCards(trackedTelegramBotUrl ?? getTrackedTelegramBotFallback());

  return (
    <section id="projects" className="scroll-mt-24 py-8 sm:py-10">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#FFD166]">Lernangebote</p>
          <h2 className="mt-2 break-words text-2xl font-semibold text-white sm:text-4xl">
            Wähle das Format, das zu dir passt
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-300">
          Drei klare Wege für kurze Quizrunden, tägliche Lernimpulse und persönliches Training.
        </p>
      </div>
      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {productCards.map((product) => (
          <ProjectCard key={product.title} product={product} />
        ))}
      </div>
    </section>
  );
}

export function PublicHomeFurtherProjectsSection() {
  const furtherProjects = [
    {
      title: "Worklog",
      analyticsId: "worklog_apk",
      category: "Produktivität · Android",
      description:
        "Eine eigenständige Android-App, um Aufgaben, Notizen und Arbeitsabläufe übersichtlich zu organisieren.",
      href: WORKLOG_DOWNLOAD_PATH,
      actionLabel: "Android-App herunterladen",
      imageSrc: WORKLOG_LOGO_PATH,
      badge: "Wo",
      download: "worklog.apk",
      external: false,
    },
    {
      title: "Bücher",
      analyticsId: "books",
      category: "Lesen & Lernen",
      description:
        "Deutsch für Elektriker als Printausgabe und Kindle-eBook – weitere Titel folgen.",
      href: "/books",
      actionLabel: "Bücher entdecken",
      imageSrc: undefined,
      badge: "Bü",
      download: undefined,
      external: false,
    },
    {
      title: "Shorts Blocker Kids",
      analyticsId: "shorts_blocker",
      category: "Digitales Wohlbefinden",
      description:
        "Ein eigenständiges Projekt für einen bewussteren Umgang mit Kurzvideo-Feeds auf Kindergeräten.",
      href: "https://www.shortsblockerkids.de/",
      actionLabel: "Projekt ansehen",
      imageSrc: undefined,
      badge: "SB",
      download: undefined,
      external: true,
    },
  ] as const;

  return (
    <section id="further-projects" className="scroll-mt-24 py-8 sm:py-10">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-400">Außerdem von uns</p>
        <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Weitere Projekte</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Bücher und eigenständige Projekte neben unseren digitalen Lernformaten.
        </p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {furtherProjects.map((project) => {
          const content = (
            <>
              <span
                aria-hidden="true"
                className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] text-xs font-bold text-[#FFD166]"
              >
                {project.imageSrc ? (
                  <Image
                    src={project.imageSrc}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-contain p-2"
                  />
                ) : (
                  project.badge
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {project.category}
                </span>
                <span className="mt-1 block text-lg font-semibold text-white">{project.title}</span>
                <span className="mt-2 block text-sm leading-6 text-slate-300">
                  {project.description}
                </span>
                <span className="mt-4 block text-sm font-semibold text-[#B9FFF2]">
                  {project.actionLabel} <span aria-hidden="true">→</span>
                </span>
              </span>
            </>
          );

          const className = `flex min-w-0 items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-[#4DE2C6]/30 hover:bg-white/[0.07] sm:p-5 ${LINK_FOCUS_CLASS}`;

          return project.download ? (
            <a
              key={project.title}
              href={project.href}
              {...analyticsAttributes(project.analyticsId, "home_projects")}
              download={project.download}
              aria-label={`${project.title}: ${project.actionLabel}`}
              className={className}
            >
              {content}
            </a>
          ) : project.external ? (
            <a
              key={project.title}
              href={project.href}
              {...analyticsAttributes(project.analyticsId, "home_projects")}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.title}: ${project.actionLabel} (öffnet in einem neuen Tab)`}
              className={className}
            >
              {content}
            </a>
          ) : (
            <Link
              key={project.title}
              href={project.href}
              {...analyticsAttributes(project.analyticsId, "home_projects")}
              aria-label={`${project.title}: ${project.actionLabel}`}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function PublicHomeKnowledgeSection() {
  return (
    <section id="knowledge" className="scroll-mt-24 py-8 sm:py-10">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#4DE2C6]">Wissen & Tipps</p>
          <h2 className="mt-2 break-words text-2xl font-semibold text-white sm:text-4xl">
            Wissen & Tipps
          </h2>
        </div>
        <p className="max-w-lg text-sm leading-6 text-slate-300">
          Lesestoff für Orientierung und ein besseres Gefühl für Sprache.
        </p>
      </div>
      <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-3">
        {WISSEN_ARTICLES.map((article) => (
          <article
            key={article.slug}
            className={`${GLASS_CARD_CLASS} flex h-full min-w-0 flex-col p-4 sm:p-6`}
          >
            <p className="text-sm font-semibold text-[#FFD166]">{article.category}</p>
            <h3 className="mt-3 break-words text-lg font-semibold leading-tight text-white sm:text-xl">
              {article.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{article.description}</p>
            <Link
              href={`/artikel/${article.slug}`}
              {...analyticsAttributes(`article_${article.slug}`, "home_articles")}
              aria-label={`Artikel lesen: ${article.title}`}
              className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFD166]/70 hover:bg-[#FFD166]/10 ${LINK_FOCUS_CLASS} sm:w-fit`}
            >
              Lesen
            </Link>
          </article>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Link
          href="/wissen"
          {...analyticsAttributes("nav_wissen", "home_articles")}
          className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 px-5 py-2.5 text-sm font-semibold text-[#B9FFF2] transition hover:bg-[#4DE2C6]/20 ${LINK_FOCUS_CLASS}`}
        >
          Alle Artikel entdecken
        </Link>
      </div>
    </section>
  );
}

export function PublicHomeContactSection({
  onOpenStudentWizard,
  onOpenPartnerWizard,
}: PublicHomeContactSectionProps = {}) {
  return (
    <>
      <section id="unterricht" className="scroll-mt-24 py-8 sm:py-10">
        <div
          className={`${GLASS_CARD_CLASS} grid min-w-0 gap-5 p-4 sm:gap-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#FFD166]">Lernbegleitung</p>
            <h2 className="mt-2 max-w-3xl break-words text-2xl font-semibold leading-tight text-white sm:text-4xl">
              Finde die Lernbegleitung, die zu deinen Zielen passt.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:leading-8">
              Ob Alltag, Beruf oder Prüfung: Teile uns dein Deutschniveau, deine Ziele und deinen
              Zeitplan mit. So können wir die passende Lernform für dich finden.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStudentWizard}
            data-wizard="student"
            {...analyticsAttributes("student_form", "home_contact")}
            className={`w-full sm:w-auto ${ORANGE_BUTTON_CLASS}`}
          >
            Lernbegleitung anfragen
          </button>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 py-8 sm:py-10">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
          <article className={`${GLASS_CARD_CLASS} min-w-0 p-4 sm:p-8`}>
            <p className="text-sm font-semibold text-[#4DE2C6]">Kooperationen</p>
            <h2 className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Gemeinsam mehr Menschen für Deutsch begeistern.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:leading-8">
              Wir arbeiten mit Kanälen, Lehrkräften, Schulen und Lerncommunities an Formaten, die
              Deutschlernen zugänglich, motivierend und wirksam machen.
            </p>
            <button
              type="button"
              onClick={onOpenPartnerWizard}
              data-wizard="partner"
              {...analyticsAttributes("partner_form", "home_contact")}
              className={`mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#4DE2C6]/30 bg-[#4DE2C6]/10 px-5 py-2.5 text-center text-sm font-semibold leading-snug text-[#B9FFF2] transition hover:bg-[#4DE2C6]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9FFF2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111f] sm:w-auto`}
            >
              Kooperation anfragen
            </button>
          </article>

          <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                title: "Kanäle",
                description:
                  "Gemeinsame Quizaktionen, Inhalte und Cross-Promotion für Lerncommunities.",
              },
              {
                title: "Lehrkräfte",
                description:
                  "Digitale Quizformate und ergänzende Materialien für Unterricht und Hausaufgaben.",
              },
              {
                title: "Schulen & Communities",
                description:
                  "Individuelle Lernformate für Gruppen, Kurse und Sprachprojekte.",
              },
            ].map((item) => (
              <article key={item.title} className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1726] p-4 sm:rounded-3xl sm:p-5">
                <h3 className="break-words text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function PublicHomeFooter({ trackedTelegramBotUrl }: PublicHomeFooterProps = {}) {
  const telegramUrl = trackedTelegramBotUrl ?? getTrackedTelegramBotFallback();

  return (
    <footer className="mt-6 border-t border-white/10 py-7 text-sm text-slate-400 sm:mt-8 sm:py-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 {PUBLIC_SITE_NAME}</p>
        <nav aria-label="Footer" className="flex min-w-0 flex-wrap gap-3">
          <AnalyticsSettingsButton className={`transition hover:text-white ${LINK_FOCUS_CLASS}`} />
          <Link href="/impressum" className={`transition hover:text-white ${LINK_FOCUS_CLASS}`}>
            Impressum
          </Link>
          <Link href="/privacy" className={`transition hover:text-white ${LINK_FOCUS_CLASS}`}>
            Datenschutz
          </Link>
          <Link {...analyticsAttributes("nav_contact", "footer")} href="/contact" className={`transition hover:text-white ${LINK_FOCUS_CLASS}`}>
            Kontakt
          </Link>
          <a
            href={telegramUrl}
            {...analyticsAttributes("telegram_bot", "footer")}
            target="_blank"
            rel="noreferrer"
            className={`transition hover:text-white ${LINK_FOCUS_CLASS}`}
          >
            Telegram
          </a>
        </nav>
      </div>
    </footer>
  );
}
