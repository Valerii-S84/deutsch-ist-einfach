// Product IDs are stable namespaces for routes, data and future contracts.
export const adminProducts = [
  { id: "quiz-arena", label: "Quiz Arena Bot", href: "/admin/quiz-arena/dashboard", status: "partial" },
  { id: "deutschmit", label: "Сайт deutschmit.de", href: "/admin/deutschmit", status: "analytics" },
  { id: "deutsch-trainer", label: "Deutsch Trainer Bot", href: "/admin/deutsch-trainer", status: "foundation" },
  { id: "shorts-blocker-kids", label: "Сайт Shorts Blocker Kids", href: "/admin/shorts-blocker-kids", status: "foundation" },
] as const;

export function adminProductDescription(id: string): string {
  if (id === "quiz-arena") return "Статистика, користувачі, контент, економіка, промокоди й система. Окремий вхід та чинна 2FA бота.";
  if (id === "deutschmit") return "Website Analytics v2: Overview, Sessions, Pages, Clicks/Events, Traffic, Conversions. Стара статистика сайту, заявки та архів доступні окремо.";
  return "Джерело не підключено. Відсутність даних не означає нульову активність.";
}
