import type {
  OverviewPayloadSections,
  OverviewSectionResult,
} from "@/lib/quiz-arena-statistics";

import {
  FEATURE_USAGE_DEFINITIONS,
  FUNNEL_STEP_ORDER,
  KPI_DEFINITIONS,
} from "./dashboard-config";
import { findPeakHourlyActivity, mapFunnelStep, mapProductLabel } from "./dashboard-helpers";
import type {
  AlertItem,
  DashboardDistributionSection,
  DashboardHourlyInsights,
  DashboardMetricCard,
  DashboardMetricSection,
  DashboardOverviewModel,
  FunnelChartItem,
  FunnelItem,
  KpiMetric,
  MetricUnit,
  RevenueSeriesItem,
  TopProductItem,
  TopProductChartItem,
  UserDistributionItem,
  UserLanguageDistributionItem,
  UsersSeriesItem,
} from "./dashboard-types";

type MetricDefinition = {
  key: string;
  label: string;
  hint: string;
  unit: MetricUnit;
};

const DISTRIBUTION_COLORS = [
  "#295065",
  "#f58d74",
  "#89f5c7",
  "#e6bc77",
  "#7c6ee6",
  "#4f9a94",
  "#c96d9f",
  "#8c7a6b",
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  de: "Німецька",
  en: "Англійська",
  uk: "Українська",
  ru: "Російська",
  pl: "Польська",
  tr: "Турецька",
  ar: "Арабська",
  es: "Іспанська",
  fr: "Французька",
  it: "Італійська",
  unknown: "Невідомо",
};

function formatDistributionPercent(users: number, totalUsers: number): number {
  if (totalUsers <= 0) {
    return 0;
  }
  return (users / totalUsers) * 100;
}

function mapLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase();
}

function buildDistributionSection(
  result: OverviewSectionResult<Array<{ key: string; label: string; users: number }>>,
  emptyMessage: string,
): DashboardDistributionSection {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити розподіл користувачів.",
      totalUsers: 0,
      items: [],
    };
  }

  const totalUsers = result.data.reduce((sum, item) => sum + item.users, 0);
  const items = result.data
    .filter((item) => item.users > 0)
    .map((item, index) => ({
      key: item.key,
      label: item.label,
      users: item.users,
      percent: formatDistributionPercent(item.users, totalUsers),
      fill: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
    }));

  if (items.length === 0 || totalUsers === 0) {
    return {
      status: "empty",
      message: emptyMessage,
      totalUsers,
      items,
    };
  }

  return {
    status: "valid",
    message: null,
    totalUsers,
    items,
  };
}

function buildLanguageDistributionSection(
  result: OverviewSectionResult<UserLanguageDistributionItem[]>,
): DashboardDistributionSection {
  return buildDistributionSection(
    {
      ...result,
      data:
        result.data?.map((item) => ({
          key: item.language.trim().toLowerCase() || "unknown",
          label: mapLanguageLabel(item.language),
          users: item.users,
        })) ?? null,
    },
    "Даних про мови зареєстрованих користувачів ще немає.",
  );
}

function buildGenericDistributionSection(
  result: OverviewSectionResult<UserDistributionItem[]>,
  emptyMessage: string,
): DashboardDistributionSection {
  return buildDistributionSection(
    {
      ...result,
      data:
        result.data?.map((item) => ({
          key: item.group.trim().toLowerCase() || "unknown",
          label: item.group,
          users: item.users,
        })) ?? null,
    },
    emptyMessage,
  );
}

function buildMetricCards(
  metrics: Partial<Record<string, KpiMetric>> | null,
  definitions: readonly MetricDefinition[],
): DashboardMetricCard[] {
  return definitions.map((definition) => {
    const metric = metrics?.[definition.key] ?? null;

    return {
      key: definition.key,
      label: definition.label,
      hint: definition.hint,
      unit: definition.unit,
      metric,
      status: metric ? "valid" : "invalid",
    };
  });
}

function buildMetricSection(
  result: OverviewSectionResult<Partial<Record<string, KpiMetric>>>,
  definitions: readonly MetricDefinition[],
  label: string,
): DashboardMetricSection {
  const cards = buildMetricCards(result.data, definitions);
  const invalidCardCount = cards.filter((card) => card.status === "invalid").length;

  if (invalidCardCount === cards.length) {
    return {
      status: "invalid",
      message: `${label} не вдалося перевірити.`,
      cards,
    };
  }

  if (invalidCardCount > 0 || result.status === "partial") {
    return {
      status: "partial",
      message: `${invalidCardCount} ${label.toLowerCase()} відсутні або некоректні.`,
      cards,
    };
  }

  return {
    status: "valid",
    message: null,
    cards,
  };
}

function getMissingHours(series: { hour: number }[]): number[] {
  const knownHours = new Set(series.map((item) => item.hour));
  return Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => !knownHours.has(hour));
}

function buildHourlyActivitySection(
  result: OverviewSectionResult<DashboardHourlyInsights["series"]>,
): DashboardHourlyInsights {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити погодинну активність.",
      series: [],
      pointCount: 0,
      missingHours: Array.from({ length: 24 }, (_, hour) => hour),
      peakWindow: null,
      averageUsersPerHourBucket: null,
      topWindows: [],
    };
  }

  const series = result.data;
  const missingHours = getMissingHours(series);
  const averageUsersPerHourBucket =
    series.length > 0
      ? series.reduce((sum, item) => sum + item.active_users, 0) / series.length
      : 0;
  const topWindows = [...series]
    .filter((item) => item.active_users > 0)
    .sort((left, right) => right.active_users - left.active_users)
    .slice(0, 3);
  const peakWindow = findPeakHourlyActivity(series);
  const hasAnyActivity = topWindows.length > 0;

  if (result.status === "partial") {
    return {
      status: "partial",
      message: `${series.length} із 24 годин за часом Берліна мають дані. Пропущені години не доповнюються нулями.`,
      series,
      pointCount: series.length,
      missingHours,
      peakWindow,
      averageUsersPerHourBucket,
      topWindows,
    };
  }

  if (!hasAnyActivity) {
    return {
      status: "empty",
      message: "За вибраний період активних користувачів не зафіксовано.",
      series,
      pointCount: series.length,
      missingHours,
      peakWindow,
      averageUsersPerHourBucket,
      topWindows,
    };
  }

  return {
    status: "valid",
    message: null,
    series,
    pointCount: series.length,
    missingHours,
    peakWindow,
    averageUsersPerHourBucket,
    topWindows,
  };
}

function buildRevenueSection(
  result: OverviewSectionResult<RevenueSeriesItem[]>,
): DashboardOverviewModel["revenueSection"] {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити дохід за днями.",
      series: [],
      totalRevenueStars: null,
    };
  }

  const totalRevenueStars = result.data.reduce((sum, item) => sum + item.stars, 0);

  if (result.data.length === 0) {
    return {
      status: "empty",
      message: "За вибраний період джерело не надало даних про дохід.",
      series: result.data,
      totalRevenueStars,
    };
  }

  return {
    status: "valid",
    message: null,
    series: result.data,
    totalRevenueStars,
  };
}

function buildUsersSection(
  result: OverviewSectionResult<UsersSeriesItem[]>,
): DashboardOverviewModel["usersSection"] {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити статистику користувачів за днями.",
      series: [],
      averageActiveUsersPerDay: null,
    };
  }

  const averageActiveUsersPerDay =
    result.data.length > 0
      ? result.data.reduce((sum, item) => sum + item.active_users, 0) / result.data.length
      : 0;

  if (result.data.length === 0) {
    return {
      status: "empty",
      message: "За вибраний період джерело не надало щоденної статистики користувачів.",
      series: result.data,
      averageActiveUsersPerDay,
    };
  }

  return {
    status: "valid",
    message: null,
    series: result.data,
    averageActiveUsersPerDay,
  };
}

function buildFunnelData(data: FunnelItem[]): FunnelChartItem[] {
  const funnelByStep = new Map(data.map((item) => [item.step, item]));

  return FUNNEL_STEP_ORDER.filter((step) => funnelByStep.has(step)).map((step) => {
    const item = funnelByStep.get(step)!;
    const currentIndex = FUNNEL_STEP_ORDER.indexOf(step);
    const previousStep = currentIndex > 0 ? FUNNEL_STEP_ORDER[currentIndex - 1] : null;
    const previousItem = previousStep ? funnelByStep.get(previousStep) ?? null : null;
    const ratioToPrevious =
      previousItem === null ? null : previousItem.value > 0 ? (item.value / previousItem.value) * 100 : null;

    return {
      step: item.step,
      step_label: mapFunnelStep(item.step),
      value: item.value,
      ratio_to_previous: ratioToPrevious,
    };
  });
}

function buildFunnelSection(
  result: OverviewSectionResult<FunnelItem[]>,
): DashboardOverviewModel["funnelSection"] {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити кроки активності.",
      items: [],
    };
  }

  const items = buildFunnelData(result.data);
  const hasAnyValue = items.some((item) => item.value > 0);

  if (result.status === "partial") {
    return {
      status: "partial",
      message: `${items.length} von ${FUNNEL_STEP_ORDER.length} кроків активності мають дані.`,
      items,
    };
  }

  if (!hasAnyValue) {
    return {
      status: "empty",
      message: "За вибраний період користувачів на цих кроках не зафіксовано.",
      items,
    };
  }

  return {
    status: "valid",
    message: null,
    items,
  };
}

function buildTopProductsData(data: TopProductItem[]): TopProductChartItem[] {
  return data.map((item) => ({
    product: item.product,
    product_label: mapProductLabel(item.product),
    revenue_stars: item.revenue_stars,
  }));
}

function buildTopProductsSection(
  result: OverviewSectionResult<TopProductItem[]>,
): DashboardOverviewModel["topProductsSection"] {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити дохід за продуктами.",
      items: [],
    };
  }

  const items = buildTopProductsData(result.data);

  if (items.length === 0) {
    return {
      status: "empty",
      message: "За вибраний період доходу за продуктами не зафіксовано.",
      items,
    };
  }

  return {
    status: "valid",
    message: null,
    items,
  };
}

function buildAlertsSection(
  result: OverviewSectionResult<AlertItem[]>,
): DashboardOverviewModel["alertsSection"] {
  if (result.data === null) {
    return {
      status: "invalid",
      message: "Не вдалося перевірити попередження.",
      alerts: [],
    };
  }

  if (result.data.length === 0) {
    return {
      status: "empty",
      message: "Критичних попереджень немає.",
      alerts: result.data,
    };
  }

  return {
    status: "valid",
    message: null,
    alerts: result.data,
  };
}

export function normalizeOverviewData(data: OverviewPayloadSections): DashboardOverviewModel {
  return {
    generatedAtLabel: new Date(data.generated_at).toLocaleString("uk-UA", {
      timeZone: "Europe/Berlin",
    }),
    kpiSection: buildMetricSection(data.kpis, KPI_DEFINITIONS, "Показники"),
    featureUsageSection: buildMetricSection(
      data.feature_usage,
      FEATURE_USAGE_DEFINITIONS,
      "Показники функцій",
    ),
    hourlyActivity: buildHourlyActivitySection(data.hourly_activity_series),
    revenueSection: buildRevenueSection(data.revenue_series),
    usersSection: buildUsersSection(data.users_series),
    userLanguageSection: buildLanguageDistributionSection(data.user_language_distribution),
    userAgeSection: buildGenericDistributionSection(
      data.user_age_distribution,
      "Вік користувачів не зберігається, тому вікова статистика недоступна.",
    ),
    userGenderSection: buildGenericDistributionSection(
      data.user_gender_distribution,
      "Стать користувачів не зберігається, тому відповідна статистика недоступна.",
    ),
    funnelSection: buildFunnelSection(data.funnel),
    topProductsSection: buildTopProductsSection(data.top_products),
    alertsSection: buildAlertsSection(data.alerts),
  };
}
