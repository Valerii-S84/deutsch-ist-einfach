// Product IDs are stable namespaces for routes, data and future contracts.
export const adminProducts = [
  { id: "quiz-arena", label: "Quiz Arena Bot", href: "/admin/quiz-arena/dashboard", status: "partial" },
  { id: "deutschmit", label: "Сайт deutschmit.de", href: "/admin/deutschmit", status: "analytics" },
  { id: "deutsch-trainer", label: "Deutsch Trainer Bot", href: "/admin/deutsch-trainer", status: "foundation" },
  { id: "shorts-blocker-kids", label: "Сайт Shorts Blocker Kids", href: "/admin/shorts-blocker-kids", status: "foundation" },
] as const;

export function adminProductDescription(id: string): string {
  if (id === "quiz-arena") return "Активність бота, користувачі, вікторини, покупки та підписки. Сесія бота відкривається під час входу власника; другий фактор перевіряється, якщо його вимагає бот.";
  if (id === "deutschmit") return "Відвідувачі, відвідування, переглянуті сторінки, натискання, джерела переходів і результати дій. Заявки та попередні дані також доступні.";
  return "Джерело не підключено. Відсутність даних не означає нульову активність.";
}
