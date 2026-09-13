import Link from "next/link";
import { adminProducts } from "@/lib/admin-products";

export function ProductSwitcher() {
  return <nav aria-label="Перемикання продуктів" className="mt-4 space-y-2 text-sm">
    <Link href={{ pathname: "/admin/products" }} className="block rounded-lg border border-ember/20 px-3 py-2 font-semibold">Усі продукти</Link>
    {adminProducts.map(item => <Link key={item.id} href={{ pathname: item.href }} className="block rounded-lg px-3 py-2 hover:bg-ember/5">{item.label}</Link>)}
  </nav>;
}
