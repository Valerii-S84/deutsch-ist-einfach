"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_STYLE,
} from "./dashboard-config";
import {
  formatHourLabel,
  formatHourRangeLabel,
  formatShortDateLabel,
  mapAlert,
} from "./dashboard-helpers";
import { ChartFallback, formatMetricValue, SectionStateNotice } from "./dashboard-overview-section-shared";
import type { DashboardDistributionSection, DashboardOverviewModel } from "./dashboard-types";

type DashboardOverviewSectionsProps = {
  model: DashboardOverviewModel;
};

function buildActivityBadge(model: DashboardOverviewModel): string {
  const { hourlyActivity } = model;

  if (hourlyActivity.status === "invalid") {
    return "Час Берліна · некоректні дані";
  }

  if (hourlyActivity.status === "partial") {
    return `Час Берліна · ${hourlyActivity.pointCount} із 24 годин`;
  }

  return `Час Берліна · ${hourlyActivity.pointCount} годин`;
}

function buildAverageHourDescription(model: DashboardOverviewModel): string {
  const { hourlyActivity } = model;

  if (hourlyActivity.status === "partial") {
    return "Середнє за наявними годинами за часом Берліна. Пропущені години не доповнюються нулями.";
  }

  if (hourlyActivity.status === "invalid") {
    return "Для цього показника немає достовірних погодинних даних.";
  }

  return "Середня кількість окремих активних користувачів на годину за часом Берліна у вибраному періоді.";
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("uk-UA", { maximumFractionDigits: 1 })}%`;
}

function DistributionPieCard({
  eyebrow,
  title,
  description,
  section,
}: {
  eyebrow: string;
  title: string;
  description: string;
  section: DashboardDistributionSection;
}) {
  const canRenderChart = section.status !== "invalid" && section.items.length > 0;

  return (
    <article className="surface overflow-hidden rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember/45">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl">{title}</h2>
          <p className="mt-1 text-sm text-ember/70">{description}</p>
        </div>
        <div className="rounded-full border border-ember/15 bg-white/80 px-3 py-1 text-xs text-ember/75">
          Усього: {section.status === "invalid" ? "Немає даних" : section.totalUsers.toLocaleString("uk-UA")}
        </div>
      </div>
      <div className="mt-4">
        <SectionStateNotice status={section.status} message={section.message} />
      </div>
      <div className="mt-4 h-[18rem] rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(41,80,101,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,244,241,0.98))] p-3">
        {canRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, _name, props) => {
                  const percent = Number(props.payload?.percent ?? 0);
                  return [
                    `${Number(value).toLocaleString("uk-UA")} Користувачі · ${formatPercent(percent)}`,
                    props.payload?.label ?? "Користувачі",
                  ];
                }}
              />
              <Pie
                data={section.items}
                dataKey="users"
                nameKey="label"
                innerRadius="56%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={3}
              >
                {section.items.map((item) => (
                  <Cell key={item.key} fill={item.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartFallback message={section.message ?? "Даних про розподіл немає."} />
        )}
      </div>
      <div className="mt-4 space-y-2">
        {section.items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="truncate font-medium text-[#1f4257]">{item.label}</span>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ember/70">
              {formatPercent(item.percent)} · {item.users.toLocaleString("uk-UA")}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function DashboardActivitySection({
  model,
}: DashboardOverviewSectionsProps) {
  const { hourlyActivity } = model;
  const shouldRenderChart = hourlyActivity.status !== "invalid" && hourlyActivity.pointCount > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.62fr)]">
      <article className="surface overflow-hidden rounded-[32px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember/45">
              Активність
            </p>
            <h2 className="mt-1 text-2xl">Активні користувачі за годинами (Берлін)</h2>
            <p className="mt-1 text-sm text-ember/70">
              Окремі активні користувачі за кожною годиною за часом Берліна у вибраному періоді.
            </p>
          </div>
          <div className="rounded-full border border-ember/15 bg-white/80 px-3 py-1 text-xs text-ember/75">
            {buildActivityBadge(model)}
          </div>
        </div>
        <div className="mt-4">
          <SectionStateNotice status={hourlyActivity.status} message={hourlyActivity.message} />
        </div>
        <div className="mt-4 h-[24rem] rounded-[26px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(41,80,101,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(137,245,199,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(242,247,249,0.98))] p-3">
          {shouldRenderChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyActivity.series}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardHourlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#295065" stopOpacity={0.96} />
                    <stop offset="100%" stopColor="#89f5c7" stopOpacity={0.84} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={CHART_GRID_STROKE}
                  strokeDasharray="4 8"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={CHART_AXIS_TICK}
                  tickFormatter={formatHourLabel}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={12}
                />
                <YAxis
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(41, 80, 101, 0.06)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(value) => `${formatHourLabel(Number(value))} Uhr`}
                  formatter={(value) => [
                    `${Number(value).toLocaleString("uk-UA")} Користувачі`,
                    "Активні",
                  ]}
                />
                <Bar
                  dataKey="active_users"
                  name="Активні"
                  fill="url(#dashboardHourlyGradient)"
                  radius={[12, 12, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartFallback message="Погодинні дані для цього розділу недоступні." />
          )}
        </div>
      </article>

      <article className="surface rounded-[32px] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember/45">
          Погодинна активність
        </p>
        <div className="mt-4 space-y-3">
          <div className="rounded-[24px] border border-[#295065]/12 bg-[linear-gradient(135deg,rgba(41,80,101,0.12),rgba(137,245,199,0.18))] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ember/50">Пік</p>
            <p className="mt-2 text-2xl font-semibold text-[#1f4257]">
              {hourlyActivity.peakWindow
                ? formatHourRangeLabel(hourlyActivity.peakWindow.hour)
                : "Немає даних"}
            </p>
            <p className="mt-1 text-sm text-ember/70">
              {hourlyActivity.peakWindow
                ? `${hourlyActivity.peakWindow.active_users.toLocaleString("uk-UA")} активних користувачів у пікову годину`
                : "За період немає достатніх даних для визначення пікової години."}
            </p>
          </div>

          <div className="rounded-[24px] border border-ember/12 bg-[#fff9f3] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ember/50">
              У середньому за годину
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#1f4257]">
              {formatMetricValue(hourlyActivity.averageUsersPerHourBucket, (value) =>
                value.toLocaleString("uk-UA", {
                  maximumFractionDigits: 1,
                }),
              )}
            </p>
            <p className="mt-1 text-sm text-ember/70">{buildAverageHourDescription(model)}</p>
          </div>

          <div className="rounded-[24px] border border-ember/12 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ember/50">Найактивніші години</p>
            <div className="mt-3 space-y-2">
              {hourlyActivity.topWindows.length > 0 ? (
                hourlyActivity.topWindows.map((item) => (
                  <div
                    key={item.hour}
                    className="flex items-center justify-between rounded-2xl border border-ember/10 bg-[#fffdf9] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[#1f4257]">
                      {formatHourRangeLabel(item.hour)}
                    </span>
                    <span className="rounded-full bg-[#1f4257] px-2.5 py-1 text-xs font-semibold text-white">
                      {item.active_users.toLocaleString("uk-UA")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ember/65">Даних про активність ще немає.</p>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export function DashboardUserDemographicsSection({
  model,
}: DashboardOverviewSectionsProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <DistributionPieCard
        eyebrow="Профіль користувачів"
        title="Мови користувачів"
        description="Частки зареєстрованих користувачів за мовою Telegram."
        section={model.userLanguageSection}
      />
      <DistributionPieCard
        eyebrow="Демографія"
        title="Вік користувачів"
        description="Розподіл доступний лише за наявності вікових даних у джерелі."
        section={model.userAgeSection}
      />
      <DistributionPieCard
        eyebrow="Демографія"
        title="Стать користувачів"
        description="Розподіл доступний лише за наявності даних про стать у джерелі."
        section={model.userGenderSection}
      />
    </section>
  );
}

export function DashboardRevenueUsersSection({
  model,
}: DashboardOverviewSectionsProps) {
  const canRenderRevenueChart =
    model.revenueSection.status !== "invalid" && model.revenueSection.series.length > 0;
  const canRenderUsersChart =
    model.usersSection.status !== "invalid" && model.usersSection.series.length > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="surface overflow-hidden rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Дохід за днями (⭐)</h2>
            <p className="mt-1 text-sm text-ember/70">
              Дохід у Telegram Stars за днями.
            </p>
          </div>
          <div className="rounded-full border border-ember/15 bg-white/80 px-3 py-1 text-xs text-ember/75">
            Усього:{" "}
            {formatMetricValue(model.revenueSection.totalRevenueStars, (value) =>
              `${value.toLocaleString("uk-UA")} ⭐`,
            )}
          </div>
        </div>
        <div className="mt-4">
          <SectionStateNotice
            status={model.revenueSection.status}
            message={model.revenueSection.message}
          />
        </div>
        <div className="mt-4 h-[22rem] rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(137,245,199,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,244,0.96))] p-3">
          {canRenderRevenueChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={model.revenueSection.series}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#89f5c7" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#89f5c7" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="4 8" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={CHART_AXIS_TICK}
                  tickFormatter={formatShortDateLabel}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: "#295065", strokeDasharray: "4 6", strokeOpacity: 0.35 }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(value) => formatShortDateLabel(String(value))}
                  formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ⭐`, "Дохід"]}
                />
                <Area
                  type="monotone"
                  dataKey="stars"
                  stroke="#295065"
                  strokeWidth={3}
                  fill="url(#dashboardRevenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartFallback message={model.revenueSection.message ?? "Даних про дохід немає."} />
          )}
        </div>
      </article>

      <article className="surface overflow-hidden rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl">Нові та активні користувачі</h2>
            <p className="mt-1 text-sm text-ember/70">
              Реєстрації та активні користувачі за днями.
            </p>
          </div>
          <div className="rounded-full border border-ember/15 bg-white/80 px-3 py-1 text-xs text-ember/75">
            Середня активність за день із даними:{" "}
            {formatMetricValue(model.usersSection.averageActiveUsersPerDay, (value) =>
              value.toLocaleString("uk-UA", { maximumFractionDigits: 1 }),
            )}
          </div>
        </div>
        <div className="mt-4">
          <SectionStateNotice
            status={model.usersSection.status}
            message={model.usersSection.message}
          />
        </div>
        <div className="mt-4 h-[22rem] rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(245,141,116,0.16),transparent_44%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(249,244,241,0.98))] p-3">
          {canRenderUsersChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={model.usersSection.series}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="4 8" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={CHART_AXIS_TICK}
                  tickFormatter={formatShortDateLabel}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: "#f58d74", strokeDasharray: "4 6", strokeOpacity: 0.28 }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(value) => formatShortDateLabel(String(value))}
                />
                <Line dataKey="new_users" name="Нові" stroke="#f58d74" strokeWidth={3} dot={false} />
                <Line
                  dataKey="active_users"
                  name="Активні"
                  stroke="#295065"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartFallback message={model.usersSection.message ?? "Даних про користувачів немає."} />
          )}
        </div>
      </article>
    </section>
  );
}

export function DashboardFunnelProductsSection({
  model,
}: DashboardOverviewSectionsProps) {
  const canRenderFunnelChart =
    model.funnelSection.status !== "invalid" && model.funnelSection.items.length > 0;
  const canRenderProductsChart =
    model.topProductsSection.status !== "invalid" && model.topProductsSection.items.length > 0;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="surface overflow-hidden rounded-3xl p-5">
        <div>
          <h2 className="text-xl">Кроки активності за період</h2>
          <p className="mt-1 text-sm text-ember/70">
            Досягнення за вибраний період. Кроки можуть стосуватися різних груп користувачів.
          </p>
        </div>
        <div className="mt-4">
          <SectionStateNotice
            status={model.funnelSection.status}
            message={model.funnelSection.message}
          />
        </div>
        <div className="mt-4 h-[22rem] rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(137,245,199,0.20),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,248,245,0.98))] p-3">
          {canRenderFunnelChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={model.funnelSection.items}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardFunnelGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#89f5c7" stopOpacity={0.98} />
                    <stop offset="100%" stopColor="#295065" stopOpacity={0.88} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="4 8" horizontal={false} />
                <XAxis
                  type="number"
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="step_label"
                  width={130}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="url(#dashboardFunnelGradient)" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartFallback message={model.funnelSection.message ?? "Даних про кроки активності немає."} />
          )}
        </div>
        <div className="mt-3 space-y-1 text-xs text-ember/75">
          {model.funnelSection.items.map((item, index) => (
            <p key={`${item.step}-${index}`}>
              {item.step_label}: {item.value.toLocaleString("uk-UA")} Користувачі
              {item.ratio_to_previous !== null
                ? ` · ${item.ratio_to_previous.toLocaleString("uk-UA", {
                    maximumFractionDigits: 1,
                  })}% від попереднього кроку за той самий період`
                : ""}
            </p>
          ))}
        </div>
      </article>

      <article className="surface overflow-hidden rounded-3xl p-5">
        <div>
          <h2 className="text-xl">Найпопулярніші продукти за доходом (⭐)</h2>
          <p className="mt-1 text-sm text-ember/70">
            Продукти з найбільшим доходом у Telegram Stars.
          </p>
        </div>
        <div className="mt-4">
          <SectionStateNotice
            status={model.topProductsSection.status}
            message={model.topProductsSection.message}
          />
        </div>
        <div className="mt-4 h-[22rem] rounded-2xl border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(245,141,116,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(251,245,242,0.98))] p-3">
          {canRenderProductsChart ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={model.topProductsSection.items}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardProductsGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f58d74" stopOpacity={0.98} />
                    <stop offset="100%" stopColor="#e6bc77" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID_STROKE} strokeDasharray="4 8" horizontal={false} />
                <XAxis
                  type="number"
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="product_label"
                  type="category"
                  width={132}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ⭐`, "Дохід"]}
                />
                <Bar dataKey="revenue_stars" fill="url(#dashboardProductsGradient)" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartFallback
              message={model.topProductsSection.message ?? "Даних про дохід за продуктами немає."}
            />
          )}
        </div>
      </article>
    </section>
  );
}

export function DashboardAlertsSection({ model }: DashboardOverviewSectionsProps) {
  return (
    <section className="surface rounded-2xl p-4">
      <h2 className="text-xl">Попередження</h2>
      <div className="mt-3">
        <SectionStateNotice status={model.alertsSection.status} message={model.alertsSection.message} />
      </div>
      <div className="mt-3 space-y-2">
        {model.alertsSection.alerts.map((alert, index) => {
          const mapped = mapAlert(alert);
          return (
            <article
              key={`${alert.type}-${index}`}
              className="rounded-lg border border-ember/15 bg-white/70 px-3 py-2 text-sm"
            >
              <p className="font-medium text-ember">{mapped.title}</p>
              <p className="mt-1 text-ember/80">{mapped.details}</p>
              <p className="mt-1 text-xs text-ember/65">{mapped.action}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
