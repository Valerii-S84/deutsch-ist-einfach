// Product IDs are stable namespaces for routes, data and future contracts.
export const adminProducts = [
  { id: "quiz-arena", label: "Quiz Arena Bot", href: "/admin/quiz-arena/dashboard", status: "partial" },
  { id: "deutschmit", label: "Сайт deutschmit.de", href: "/admin/deutschmit", status: "analytics" },
  { id: "deutsch-trainer", label: "Deutsch Trainer Bot", href: "/admin/deutsch-trainer", status: "foundation" },
] as const;

export function adminProductDescription(id: string): string {
  if (id === "quiz-arena") return "Активність бота, користувачі, вікторини, покупки та підписки. Сесія бота відкривається під час входу власника; другий фактор перевіряється, якщо його вимагає бот.";
  if (id === "deutschmit") return "Контактні заявки сайту та архів заявок Quiz Arena. Статистика відвідувань — в Umami.";
  return "Джерело не підключено. Відсутність даних не означає нульову активність.";
}
