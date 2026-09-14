import type { MetricUnit } from "./dashboard-types";

type MetricDefinition = {
  key: string;
  label: string;
  hint: string;
  unit: MetricUnit;
};

export const PERIOD_OPTIONS = [
  { value: "7d", label: "7 днів" },
  { value: "30d", label: "30 днів" },
  { value: "90d", label: "90 днів" },
] as const;

export const OVERVIEW_PERIODS = PERIOD_OPTIONS.map((option) => option.value) as [
  "7d",
  "30d",
  "90d",
];

export const FUNNEL_STEP_ORDER = [
  "Start",
  "First Quiz",
  "Streak 3+",
  "Purchase",
] as const;

export const KPI_DEFINITIONS: MetricDefinition[] = [
  {
    key: "dau",
    label: "Активні за 24 години",
    hint: "Окремі користувачі з активністю за останні 24 години.",
    unit: "count",
  },
  {
    key: "wau",
    label: "Активні за 7 днів",
    hint: "Окремі користувачі з активністю за останні 7 днів.",
    unit: "count",
  },
  {
    key: "mau",
    label: "Активні за 30 днів",
    hint: "Окремі користувачі з активністю за останні 30 днів.",
    unit: "count",
  },
  {
    key: "new_users",
    label: "Нові користувачі",
    hint: "Реєстрації за вибраний період.",
    unit: "count",
  },
  {
    key: "revenue_stars",
    label: "Дохід у Stars",
    hint: "Дохід у Telegram Stars.",
    unit: "stars",
  },
  {
    key: "revenue_eur",
    label: "Дохід у євро",
    hint: "Оцінка доходу в євро.",
    unit: "eur",
  },
  {
    key: "active_subscriptions",
    label: "Чинні підписки Premium",
    hint: "Чинні підписки Premium на поточну мить.",
    unit: "count",
  },
  {
    key: "retention_d1",
    label: "Повернення наступного дня",
    hint: "Частка нових користувачів, які повернулися наступного дня.",
    unit: "percent",
  },
  {
    key: "retention_d7",
    label: "Повернення через 7 днів",
    hint: "Частка нових користувачів, які повернулися через 7 днів.",
    unit: "percent",
  },
  {
    key: "start_users",
    label: "Нові користувачі для розрахунку часток",
    hint: "Джерело рахує нових користувачів; це не кількість натискань команди /start.",
    unit: "count",
  },
  {
    key: "conversion_start_to_quiz",
    label: "Нові користувачі з першою вікториною",
    hint: "Частка нових користувачів, які вперше пройшли вікторину за період.",
    unit: "percent",
  },
  {
    key: "conversion_quiz_to_purchase",
    label: "Від вікторини до покупки",
    hint: "Частка активних учасників вікторин, які також здійснили покупку.",
    unit: "percent",
  },
];

export const FEATURE_USAGE_DEFINITIONS: MetricDefinition[] = [
  {
    key: "duel_created_users",
    label: "Створили дуель",
    hint: "Користувачі, які створили дружню дуель.",
    unit: "count",
  },
  {
    key: "duel_completed_users",
    label: "Завершили дуель",
    hint: "Користувачі із завершеною дружньою дуеллю.",
    unit: "count",
  },
  {
    key: "duel_completion_rate",
    label: "Частка завершення дуелей",
    hint: "Окремі користувачі із завершеною дуеллю / окремі користувачі зі створеною дуеллю.",
    unit: "percent",
  },
  {
    key: "referral_shared_users",
    label: "Поділилися запрошенням",
    hint: 'Користувачі, die "Freund einladen" geteilt haben.',
    unit: "count",
  },
  {
    key: "referral_referrers_started",
    label: "Запросили нових користувачів",
    hint: "Користувачі, за кодом яких приєднався новий друг.",
    unit: "count",
  },
  {
    key: "daily_cup_registered_users",
    label: "Учасники щоденного кубка",
    hint: "Користувачі, зареєстровані у щоденному кубку.",
    unit: "count",
  },
];

export const FUNNEL_STEP_LABELS: Record<string, string> = {
  Start: "Нові користувачі",
  "First Quiz": "Перша вікторина",
  "Streak 3+": "Streak 3+",
  Purchase: "Перша покупка",
};

export const PRODUCT_LABELS: Record<string, string> = {
  ENERGY_10: "Енергія +10",
  STREAK_SAVER_20: "Збереження серії",
  FRIEND_CHALLENGE_5: "Квиток на дуель",
  PREMIUM_STARTER: "Стартовий Premium",
  PREMIUM_MONTH: "Premium на місяць",
  PREMIUM_SEASON: "Сезонний Premium",
  PREMIUM_YEAR: "Premium на рік",
};

export const CHART_AXIS_TICK = {
  fill: "#7d6658",
  fontSize: 12,
};

export const CHART_GRID_STROKE = "rgba(41, 80, 101, 0.12)";

export const CHART_TOOLTIP_STYLE = {
  borderRadius: "18px",
  border: "1px solid rgba(41, 80, 101, 0.14)",
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.14)",
  backgroundColor: "rgba(255, 255, 255, 0.96)",
};
