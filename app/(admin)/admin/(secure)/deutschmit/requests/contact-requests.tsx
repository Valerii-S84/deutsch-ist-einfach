"use client";
import { DeutschmitNavigation } from "../analytics-ui";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/quiz-arena-api";
const statuses = ["NEW", "IN_PROGRESS", "DONE", "SPAM"] as const;
const schema = z.object({ items: z.array(z.object({ id: z.union([z.string(), z.number().int().safe()]), type: z.string(), status: z.enum(statuses), name: z.string(), contact: z.string(), payload: z.record(z.unknown()), created_at: z.string() })), total: z.number().int().nonnegative(), page: z.number().int(), pages: z.number().int() });
async function siteRequest(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? "PATCH" : "GET", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("CONTACT_REQUEST_FAILED");
  return response.json();
}
export default function ContactRequests({ archiveOnly = false }: { archiveOnly?: boolean }) {
  const [source, setSource] = useState(archiveOnly ? "legacy" : "site");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["site-contacts", source, page], retry: false, staleTime: 0, gcTime: 0, queryFn: async () => schema.parse(source !== "legacy" ? await siteRequest(`/api/admin/contact-requests?page=${page}&scope=${source === "test" ? "test" : "production"}`) : (await api.get("/admin/contact-requests", { params: { page, limit: 20 } })).data) });
  const mutation = useMutation({ retry: false, mutationFn: async ({ id, status, expected_status }: { id: number | string; status: string; expected_status: string }) => {
    const result = source !== "legacy" ? await siteRequest("/api/admin/contact-requests", { id, status, expected_status }) : (await api.post(`/admin/contact-requests/${id}/status`, { status })).data;
    if (result.status !== status || String(result.id) !== String(id)) throw new Error("STATUS_NOT_CONFIRMED");
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["site-contacts", source] }); setNotice("Статус збережено; список оновлено."); }, onError: () => setNotice("Зміну не підтверджено або статус уже змінено іншим запитом. Оновіть список перед повторенням.") });
  return <main className="surface space-y-4 rounded-2xl p-5">
    {archiveOnly ? null : <DeutschmitNavigation active="requests" />}
    <h2 className="text-3xl">{source === "legacy" ? "Архів заявок Quiz Arena" : source === "test" ? "Тестові заявки deutschmit.de" : "Контактні заявки deutschmit.de"}</h2>
    <p>Керування заявками збережене окремо від аналітики. Тексти форм не надсилаються в аналітичні події.</p>
    <select aria-label="Джерело заявок" disabled={mutation.isPending || archiveOnly} value={source} onChange={event => { setSource(event.target.value); setPage(1); setNotice(""); }}><option value="site">Робочі заявки сайту</option><option value="test">Тестові заявки</option><option value="legacy">Архів сайту в Quiz Arena backend</option></select>
    {source === "legacy" ? <p>Архів потребує окремого входу в Quiz Arena Bot. Нові заявки сайту тут не зберігаються.</p> : null}
    {query.isLoading ? <p role="status">Завантаження…</p> : query.error ? <p role="alert">Джерело недоступне або відповідь невалідна. Це не нуль заявок.</p> : query.data ? <>
      <p>Усього в цьому джерелі: {query.data.total}</p>
      {query.data.items.length === 0 ? <p>У цій вибірці заявок немає.</p> : null}
      {query.data.items.map(item => <article key={item.id} className="space-y-2 rounded-xl border p-3">
        <h2>{item.name} · {item.contact}</h2><p>{item.type} · {item.created_at}</p>
        <select aria-label={`Статус заявки ${item.id}`} disabled={mutation.isPending} value={item.status} onChange={event => mutation.mutate({ id: item.id, status: event.target.value, expected_status: item.status })}>{statuses.map(status => <option key={status}>{status}</option>)}</select>
        <details><summary>Деталі заявки</summary><dl>{Object.entries(item.payload).map(([key, value]) => <div key={key}><dt>{key}</dt><dd className="whitespace-pre-wrap break-words">{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl></details>
      </article>)}
      <button disabled={page <= 1 || mutation.isPending} onClick={() => setPage(page - 1)}>Назад</button> · {page}/{query.data.pages} · <button disabled={page >= query.data.pages || mutation.isPending} onClick={() => setPage(page + 1)}>Далі</button>
    </> : null}
    {notice ? <p role="status">{notice}</p> : null}<button onClick={() => void query.refetch()}>Оновити</button>
  </main>;
}
