"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  UMAMI_WEBSITE_ID,
  removeLegacyAnalyticsStorage,
  track,
  umamiBeforeSend,
  type UmamiEvent,
} from "@/lib/umami";

export function UmamiScript() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    removeLegacyAnalyticsStorage();
    window.deutschmitUmamiBeforeSend = umamiBeforeSend;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const element = target?.closest("[data-track]");
      if (!element) return;
      const data: Record<string, string | number> = {};
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.startsWith("data-track-")) {
          data[attribute.name.slice("data-track-".length)] = attribute.value;
        }
      }
      track(element.getAttribute("data-track") as UmamiEvent, Object.keys(data).length ? data : undefined);
    };
    document.addEventListener("click", onClick);
    setReady(true);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!ready || !UMAMI_WEBSITE_ID) return null;
  return (
    <Script
      src="/u/script.js"
      strategy="afterInteractive"
      data-website-id={UMAMI_WEBSITE_ID}
      data-domains="deutschmit.de"
      data-exclude-search="true"
      data-exclude-hash="true"
      data-before-send="deutschmitUmamiBeforeSend"
    />
  );
}
