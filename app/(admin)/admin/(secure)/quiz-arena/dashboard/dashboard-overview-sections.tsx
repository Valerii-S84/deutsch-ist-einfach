"use client";

import { deltaClassName, formatDelta, formatValue } from "./dashboard-helpers";
import { SectionStateNotice } from "./dashboard-overview-section-shared";
import {
  DashboardActivitySection,
  DashboardAlertsSection,
  DashboardFunnelProductsSection,
  DashboardRevenueUsersSection,
  DashboardUserDemographicsSection,
} from "./dashboard-overview-chart-sections";
import type { DashboardOverviewModel } from "./dashboard-types";

type DashboardOverviewSectionsProps = {
  model: DashboardOverviewModel;
};

function DashboardKpiSection({ model }: DashboardOverviewSectionsProps) {
  return (
    <section className="space-y-3">
      <SectionStateNotice status={model.kpiSection.status} message={model.kpiSection.message} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {model.kpiSection.cards.map((card) => {
          const { metric } = card;

          return (
            <article key={card.key} className="surface rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-ember/60">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {metric ? formatValue(metric.current, card.unit) : "Keine Daten"}
              </p>
              {metric ? (
                <>
                  <p className={`mt-1 text-xs ${deltaClassName(metric.delta_pct)}`}>
                    Veränderung: {formatDelta(metric.delta_pct)}
                  </p>
                  <p className="mt-1 text-xs text-ember/60">
                    Vorher: {formatValue(metric.previous, card.unit)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-red-700">
                  Diese KPI fehlt im Payload oder hat einen ungültigen Typ.
                </p>
              )}
              <p className="mt-2 text-xs text-ember/70">{card.hint}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DashboardFeatureUsageSection({ model }: DashboardOverviewSectionsProps) {
  return (
    <section className="surface rounded-2xl p-4">
      <h2 className="text-xl">Nutzung wichtiger Funktionen</h2>
      <p className="mt-1 text-sm text-ember/70">
        Diese Werte zeigen direkt, ob zentrale Features wirklich genutzt werden.
      </p>
      <div className="mt-3">
        <SectionStateNotice
          status={model.featureUsageSection.status}
          message={model.featureUsageSection.message}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {model.featureUsageSection.cards.map((card) => {
          const { metric } = card;

          return (
            <article
              key={card.key}
              className="rounded-xl border border-ember/15 bg-white/70 p-3"
            >
              <p className="text-xs uppercase tracking-wide text-ember/60">{card.label}</p>
              <p className="mt-1 text-xl font-semibold">
                {metric ? formatValue(metric.current, card.unit) : "Keine Daten"}
              </p>
              {metric ? (
                <p className={`mt-1 text-xs ${deltaClassName(metric.delta_pct)}`}>
                  Veränderung: {formatDelta(metric.delta_pct)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-red-700">
                  Diese Feature-Metrik fehlt im Payload oder ist ungültig.
                </p>
              )}
              <p className="mt-2 text-xs text-ember/70">{card.hint}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardOverviewSections({ model }: DashboardOverviewSectionsProps) {
  return (
    <>
      <DashboardKpiSection model={model} />
      <DashboardFeatureUsageSection model={model} />
      <DashboardActivitySection model={model} />
      <DashboardRevenueUsersSection model={model} />
      <DashboardUserDemographicsSection model={model} />
      <DashboardFunnelProductsSection model={model} />
      <DashboardAlertsSection model={model} />
    </>
  );
}
