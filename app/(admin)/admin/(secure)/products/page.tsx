import Link from "next/link";
import { adminProducts, adminProductDescription } from "@/lib/admin-products";

export default function AdminProductsPage() {
  return <main className="space-y-6">
    <div><h1 className="text-3xl">Продукти</h1><p className="mt-2">Оберіть продукт для адміністрування.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      {adminProducts.map(product => <Link key={product.id} href={{ pathname: product.href }} className="surface block rounded-2xl border border-ember/20 p-6 hover:border-ember focus-visible:outline focus-visible:outline-2">
        <h2 className="text-xl">{product.label}</h2>
        <p className="mt-3 text-sm">{adminProductDescription(product.id)}</p>
      </Link>)}
    </div>
  </main>;
}
