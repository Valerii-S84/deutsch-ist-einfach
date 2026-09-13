"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/quiz-arena-api";
export function QuizLogout() {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function refresh() {
    setPending(true); setFailed(false);
    try { await api.post("/admin/auth/refresh"); await client.invalidateQueries(); }
    catch { setFailed(true); } finally { setPending(false); }
  }
  async function logout() {
    setPending(true); setFailed(false);
    try {
      await api.post("/admin/auth/logout");
      client.clear();
      window.location.href = "/admin/quiz-arena/login";
    } catch { setFailed(true); } finally { setPending(false); }
  }
  return <div className="flex flex-wrap gap-4"><button disabled={pending} onClick={refresh}>Сесію бота оновити</button><button disabled={pending} onClick={logout}>Вийти з Quiz Arena Bot</button>
    {failed ? <p role="alert">Backend не підтвердив операцію із сесією. Можна завершити власну сесію сайту через «Abmelden».</p> : null}</div>;
}
