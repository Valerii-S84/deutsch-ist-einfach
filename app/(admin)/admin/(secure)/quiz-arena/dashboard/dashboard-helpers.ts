import {
  FUNNEL_STEP_LABELS,
  PRODUCT_LABELS,
} from "./dashboard-config";
import type {
  AlertItem,
  HourlyActivityItem,
  KpiMetric,
  MetricUnit,
} from "./dashboard-types";

export function formatValue(value: number, unit: MetricUnit): string {
  if (unit === "percent") {
    return `${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  }
  if (unit === "eur") {
    return value.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  if (unit === "stars") {
    return `${value.toLocaleString("de-DE")} ⭐`;
  }
  return value.toLocaleString("de-DE");
}

export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export function deltaClassName(value: number): string {
  if (value > 0) {
    return "text-emerald-700";
  }
  if (value < 0) {
    return "text-red-700";
  }
  return "text-ember/70";
}

export function mapAlert(
  alert: AlertItem,
): { title: string; details: string; action: string } {
  if (alert.type === "webhook_errors") {
    return {
      title: "Telegram/Webhook-Fehler",
      details: `${alert.count ?? "Keine Daten"} Fehler in den letzten 24 Stunden erkannt.`,
      action: "Empfehlung: Worker-Logs prüfen und Telegram-Webhook-Status kontrollieren.",
    };
  }
  if (alert.type === "conversion_drop") {
    return {
      title: "Kauf-Konversion gesunken",
      details: `Von ${alert.from ?? "Keine Daten"}% auf ${alert.to ?? "Keine Daten"}% gefallen.`,
      action: "Empfehlung: Angebote, Checkout und letzte Produkt-Änderungen prüfen.",
    };
  }
  if (alert.type === "suspicious_activity") {
    return {
      title: "Auffällige Promo-Aktivität",
      details: `${alert.invalid_promo_attempts_1h ?? "Keine Daten"} ungültige Promo-Versuche in 1 Stunde.`,
      action: "Empfehlung: Promo-Kampagnen und Missbrauchs-Filter prüfen.",
    };
  }
  return {
    title: alert.type,
    details: "Es liegt ein Hinweis vor.",
    action: "Empfehlung: Details im System-Bereich prüfen.",
  };
}

export function mapProductLabel(productCode: string): string {
  return PRODUCT_LABELS[productCode] ?? productCode;
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatHourRangeLabel(hour: number): string {
  const nextHour = (hour + 1) % 24;
  return `${formatHourLabel(hour)}-${formatHourLabel(nextHour)}`;
}

export function formatShortDateLabel(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function mapFunnelStep(step: string): string {
  return FUNNEL_STEP_LABELS[step] ?? step;
}

export function findPeakHourlyActivity(
  series: HourlyActivityItem[] | undefined,
): HourlyActivityItem | null {
  if (!series || series.length === 0) {
    return null;
  }
  const peak = series.reduce((best, item) => {
    if (item.active_users > best.active_users) {
      return item;
    }
    return best;
  });

  return peak.active_users > 0 ? peak : null;
}
