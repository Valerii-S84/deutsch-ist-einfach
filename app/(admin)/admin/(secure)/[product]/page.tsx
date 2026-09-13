import { notFound } from "next/navigation";
import { adminProducts } from "@/lib/admin-products";

export default async function ProductFoundation({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const item = adminProducts.find((entry) => entry.id === product && entry.status === "foundation");
  if (!item) notFound();
  return <main className="surface space-y-4 rounded-2xl p-6">
    <h1 className="text-3xl">{item.label}</h1>
    <p>Каркас розділу. Нові метрики не підключено; дані інших продуктів тут не використовуються.</p>
    <p>Джерело не підключено. Відсутність підключення не означає нульову активність.</p>
  </main>;
}
