import type { DashboardSectionStatus } from "./dashboard-types";

export function formatMetricValue(
  value: number | null,
  formatter: (currentValue: number) => string,
): string {
  if (value === null) {
    return "Keine Daten";
  }
  return formatter(value);
}

function buildStatusClasses(status: DashboardSectionStatus): string {
  if (status === "invalid") {
    return "border-red-200 bg-red-50/80 text-red-800";
  }
  if (status === "partial") {
    return "border-amber-200 bg-amber-50/80 text-amber-900";
  }
  if (status === "empty") {
    return "border-slate-200 bg-slate-50/80 text-slate-700";
  }
  return "border-emerald-200 bg-emerald-50/80 text-emerald-800";
}

export function SectionStateNotice({
  status,
  message,
}: {
  status: DashboardSectionStatus;
  message: string | null;
}) {
  if (status === "valid" || !message) {
    return null;
  }

  return (
    <p className={`rounded-2xl border px-3 py-2 text-sm ${buildStatusClasses(status)}`}>
      {message}
    </p>
  );
}

export function ChartFallback({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ember/15 bg-white/70 px-6 text-center text-sm text-ember/70">
      {message}
    </div>
  );
}
