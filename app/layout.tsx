import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/space-grotesk";

import "./globals.css";
import {
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_LOGO_HEIGHT,
  PUBLIC_SITE_LOGO_PATH,
  PUBLIC_SITE_LOGO_WIDTH,
  PUBLIC_SITE_NAME,
  getSiteUrl,
} from "@/lib/public-site-config";
import { Providers } from "./providers";
import { UmamiScript } from "./umami-script";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: PUBLIC_SITE_NAME,
  title: {
    default: PUBLIC_SITE_NAME,
    template: `%s | ${PUBLIC_SITE_NAME}`,
  },
  description: PUBLIC_SITE_DESCRIPTION,
  creator: PUBLIC_SITE_NAME,
  publisher: PUBLIC_SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: PUBLIC_SITE_NAME,
    title: PUBLIC_SITE_NAME,
    description: PUBLIC_SITE_DESCRIPTION,
    images: [
      {
        url: PUBLIC_SITE_LOGO_PATH,
        width: PUBLIC_SITE_LOGO_WIDTH,
        height: PUBLIC_SITE_LOGO_HEIGHT,
        alt: `Logo von ${PUBLIC_SITE_NAME}`,
      },
    ],
  },
  icons: {
    icon: [
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon-48x48.png",
  },
  twitter: {
    card: "summary_large_image",
    title: PUBLIC_SITE_NAME,
    description: PUBLIC_SITE_DESCRIPTION,
    images: [PUBLIC_SITE_LOGO_PATH],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
        <UmamiScript />
      </body>
    </html>
  );
}
