import type { OverviewPayloadSections } from "./quiz-arena-statistics";
export function overviewConsistencyNotes(data: OverviewPayloadSections): string[] {
  const notes: string[] = [];
  const kpis = data.kpis.data;
  if (data.revenue_series.data?.length && kpis?.revenue_stars) {
    const sum = data.revenue_series.data.reduce((total, row) => total + row.stars, 0);
    if (sum !== kpis.revenue_stars.current) notes.push("Дохід графіка відрізняється від картки. Історично backend використовує різні статуси покупок; потрібна звірка джерела.");
  }
  if (data.users_series.data?.length && kpis?.new_users) {
    const sum = data.users_series.data.reduce((total, row) => total + row.new_users, 0);
    if (sum !== kpis.new_users.current) notes.push("Нові користувачі: сума денних рядків не збігається з карткою. Перевірте межі періоду й повноту даних.");
  }
  if (kpis?.revenue_eur && kpis.revenue_stars && Math.abs(kpis.revenue_eur.current - kpis.revenue_stars.current * 0.02) > 0.011) notes.push("EUR не відповідає історичному коефіцієнту 0.02 Stars. Контракт потребує уточнення.");
  return notes;
}
