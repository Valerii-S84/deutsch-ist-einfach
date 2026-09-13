import { redirect } from "next/navigation";
export default function LegacyAdminRoute() {
  redirect("/admin/quiz-arena/system");
}
