import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSiteAdminSession, SITE_ADMIN_SESSION_COOKIE } from "@/lib/server/site-admin-auth";
import { ProductSwitcher } from "./product-switcher";

export default async function SecureAdminLayout({ children }: { children: React.ReactNode }) {
  const session = getSiteAdminSession((await cookies()).get(SITE_ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 overflow-x-hidden px-4 py-6 lg:flex-row lg:items-start lg:px-6">
      <aside className="surface h-fit w-full rounded-2xl p-4 lg:sticky lg:top-6 lg:w-64">
        <p className="text-xs uppercase tracking-[0.2em] text-ember/60">Admin Bereich</p>
        <p className="mt-2 text-lg">{session.email}</p>
        <ProductSwitcher />
        <form action="/api/admin/logout" method="post" className="mt-6">
          <button className="w-full rounded-lg border border-ember/20 px-3 py-2 text-left text-sm">
            Abmelden
          </button>
        </form>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
