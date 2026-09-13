import Link from "next/link";
import { QuizLogout } from "./quiz-logout";
import { QuizArenaProvider } from "./quiz-arena-provider";

const sections = [
  ["dashboard", "Статистика"], ["users", "Користувачі"], ["content", "Контент"],
  ["economy", "Економіка"], ["promo", "Промокоди"], ["system", "Система"], ["login", "Вхід у бот"],
] as const;
export default function QuizArenaLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">
    <h2 className="text-xl">Quiz Arena Bot</h2>
    <nav aria-label="Quiz Arena Bot" className="flex flex-wrap gap-3">
      {sections.map(([path, label]) => <Link className="underline" key={path} href={{ pathname: `/admin/quiz-arena/${path}` }}>{label}</Link>)}
    </nav>
    <QuizArenaProvider><QuizLogout />{children}</QuizArenaProvider>
  </div>;
}
