"use client";

import { usePublicAnalytics } from "./analytics-provider";

export function AnalyticsSettingsButton({ className }: { className?: string }) {
  const { openSettings } = usePublicAnalytics();
  return <button type="button" className={className} onClick={openSettings}>Analytics-Einstellungen</button>;
}
