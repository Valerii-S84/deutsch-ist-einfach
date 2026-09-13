"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/quiz-arena-api";
import { QueryState } from "../query-state";
import { DataFreshness } from "../data-freshness";
const count = z.number().int().nonnegative().safe();
const profileSchema = z.object({
  info: z.object({ id: count, telegram_user_id: count, username: z.string().nullable(), first_name: z.string().nullable(), language: z.string().nullable(), status: z.string(), created_at: z.string(), last_seen_at: z.string().nullable() }),
  progress: z.object({ levels: z.array(z.object({ mode: z.string(), level: z.string() })), streak: count, best_streak: count, paid_energy: count }),
  purchases: z.array(z.object({ id: z.string(), product: z.string(), stars: count, status: z.string(), paid_at: z.string().nullable() })),
  referrals: z.array(z.object({ id: count, referrer_user_id: count, referred_user_id: count, status: z.string(), created_at: z.string() })),
  timeline: z.array(z.object({ type: z.string(), created_at: z.string(), payload: z.record(z.unknown()) })),
});
export function UserDetail({ userId, onClose }: { userId: number; onClose: () => void }) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [bonusType, setBonusType] = useState("energy");
  const [amount, setAmount] = useState(1);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["quiz-arena", "user", userId], queryFn: async () => profileSchema.parse((await api.get(`/admin/users/${userId}`)).data) });
  const mutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: unknown }) => {
      const result = (await api.post(`/admin/users/${userId}/${action}`, payload)).data;
      if (result?.ok !== true) throw new Error("Operation not confirmed");
      return action;
    },
    onSuccess: async action => {
      const refreshed = await query.refetch();
      await client.invalidateQueries({ queryKey: ["users"] });
      const expectedStatus = action === "block" ? "BLOCKED" : action === "unblock" ? "ACTIVE" : null;
      if (refreshed.error || (expectedStatus && refreshed.data?.info.status !== expectedStatus)) setNotice("Дію прийнято, але повторне читання не підтвердило результат. Не повторюйте запис автоматично.");
      else setNotice("Backend прийняв дію; профіль перечитано. Подію можна звірити в timeline. Для бонусів перевірте також entitlement/energy на backend.");
    },
    onError: () => setNotice("Результат запису не підтверджено. Перед повторенням перевірте профіль та audit."),
  });
  const profile = query.data;
  return <section className="surface space-y-4 rounded-2xl border border-ember/20 p-5">
    <div className="flex justify-between"><h2 className="text-2xl">Користувач #{userId}</h2><button onClick={onClose}>Закрити</button></div>
    {query.error || !profile ? <QueryState error={query.error} loading={query.isLoading} /> : <>
      <DataFreshness receivedAt={query.dataUpdatedAt} />
      <p>{profile.info.first_name} · @{profile.info.username ?? "—"} · {profile.info.status} · Telegram {profile.info.telegram_user_id}</p>
      <p>Streak: {profile.progress.streak}; найкращий: {profile.progress.best_streak}; оплачена енергія: {profile.progress.paid_energy}</p>
      <ul>{profile.progress.levels.map(row => <li key={row.mode}>{row.mode}: {row.level}</li>)}</ul>
      <fieldset disabled={mutation.isPending} className="flex flex-wrap gap-3">
        <legend>Керування</legend>
        <input aria-label="Причина блокування" value={reason} onChange={event => setReason(event.target.value)} maxLength={250} placeholder="Причина блокування (3–250 символів)" className="rounded border p-2" />
        <button disabled={reason.trim().length < 3} onClick={() => mutation.mutate({ action: "block", payload: { reason: reason.trim() } })}>Блокувати</button>
        <button onClick={() => mutation.mutate({ action: "unblock" })}>Розблокувати</button>
        <select aria-label="Тип бонусу" value={bonusType} onChange={event => setBonusType(event.target.value)}><option value="energy">Енергія</option><option value="streak_token">Streak token</option><option value="premium_days">Premium дні</option></select>
        <input aria-label="Кількість бонусу" type="number" min={1} max={365} value={amount} onChange={event => setAmount(Number(event.target.value))} />
        <button disabled={!Number.isInteger(amount) || amount < 1 || amount > 365} onClick={() => mutation.mutate({ action: "bonus", payload: { type: bonusType, amount } })}>Надати бонус</button>
        <button onClick={() => { if (window.confirm("Скинути streak, оплачену енергію й mix progress цього користувача?")) mutation.mutate({ action: "reset_state" }); }}>Скинути стан</button>
      </fieldset>
      {notice ? <p role="status">{notice}</p> : null}
      <h3>Останні покупки (до 50)</h3><ul>{profile.purchases.map(row => <li key={row.id}>{row.product} · {row.stars} Stars · {row.status} · {row.paid_at ?? "Немає дати оплати"}</li>)}</ul>
      <h3>Реферали (до 50)</h3><ul>{profile.referrals.map(row => <li key={row.id}>{row.referrer_user_id} → {row.referred_user_id}: {row.status}</li>)}</ul>
      <h3>Timeline (до 80)</h3>{profile.timeline.map((row, index) => <details key={`${row.created_at}-${index}`}><summary>{row.created_at} · {row.type}</summary><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(row.payload, null, 2)}</pre></details>)}
    </>}
  </section>;
}
