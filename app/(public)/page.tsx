import type { Metadata } from "next";

import {
  PublicHomeContactSection,
  PublicHomeFooter,
  PublicHomeFurtherProjectsSection,
  PublicHomeHero,
  PublicHomeKnowledgeSection,
  PublicHomeProductsSection,
  PublicHomeQuizTeaserSection,
  PublicHomeStatsSection,
} from "./public-home-sections";
import { PublicSiteHeader } from "./_components/public-site-header";
import { buildTrackedTelegramBotUrl } from "./public-home-helpers";
import { fetchPublicHomeServerStats } from "./public-home-server-stats";
import {
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_LOGO_HEIGHT,
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_LOGO_WIDTH,
  PUBLIC_SITE_NAME,
  TELEGRAM_BOT_START_PAYLOAD,
  getTelegramBotUrl,
} from "@/lib/public-site-config";
import { buildPublicSiteStructuredData } from "@/lib/public-site-structured-data";
import PublicHomeClient from "./public-home-client";

// Optional statistics are configured at runtime, including in images built with Quiz OFF.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deutsch lernen mit Quiz und Artikeln",
  description: PUBLIC_SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: PUBLIC_SITE_NAME,
    title: `Deutsch lernen mit Quiz und Artikeln | ${PUBLIC_SITE_NAME}`,
    description: PUBLIC_SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: PUBLIC_SITE_LOGO_PATH,
        width: PUBLIC_SITE_LOGO_WIDTH,
        height: PUBLIC_SITE_LOGO_HEIGHT,
        alt: `Logo von ${PUBLIC_SITE_NAME}`,
      },
    ],
  },
};

export default async function PublicHomePage() {
  const telegramBotUrl = getTelegramBotUrl();
  const trackedTelegramBotUrl = buildTrackedTelegramBotUrl(
    telegramBotUrl,
    TELEGRAM_BOT_START_PAYLOAD,
  );

  const statsState = await fetchPublicHomeServerStats();
  const structuredData = buildPublicSiteStructuredData();

  return (
    <>
      {structuredData.map((entry) => (
        <script
          key={entry["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry).replace(/</g, "\\u003c") }}
        />
      ))}
      <main
        id="public-home-root"
        className="min-h-screen bg-[linear-gradient(135deg,#06111f_0%,#0b1726_48%,#13151d_100%)] text-white"
      >
        <PublicSiteHeader trackedTelegramBotUrl={trackedTelegramBotUrl} />

        <div className="mx-auto w-full max-w-6xl px-3 pb-12 sm:px-6 sm:pb-16">
          <PublicHomeHero trackedTelegramBotUrl={trackedTelegramBotUrl} />
          <PublicHomeQuizTeaserSection trackedTelegramBotUrl={trackedTelegramBotUrl} />
          <PublicHomeStatsSection stats={statsState} />
          <PublicHomeProductsSection trackedTelegramBotUrl={trackedTelegramBotUrl} />
          <PublicHomeKnowledgeSection />
          <PublicHomeContactSection />
          <PublicHomeFurtherProjectsSection />
          <PublicHomeFooter trackedTelegramBotUrl={trackedTelegramBotUrl} />
        </div>
      </main>

      <PublicHomeClient />
    </>
  );
}
