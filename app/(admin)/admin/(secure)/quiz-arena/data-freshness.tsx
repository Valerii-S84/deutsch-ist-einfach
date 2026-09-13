"use client";
import { useEffect, useState } from "react";
export function DataFreshness({ receivedAt, generatedAt }: { receivedAt: number; generatedAt?: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const timestamp = generatedAt ? Date.parse(generatedAt) : receivedAt;
  const stale = now - timestamp > 360_000;
  return <p role="status" className={stale ? "text-amber-800" : "text-sm text-ember/70"}>
    {timestamp > now + 60_000 ? "Час джерела в майбутньому; свіжість не підтверджена. " : stale ? "Застарілі дані. " : ""}
    {generatedAt ? "Сформовано backend: " : "Отримано: "}
    {new Date(timestamp).toLocaleString("uk-UA", { timeZone: "Europe/Berlin" })} (Europe/Berlin).
    {!generatedAt ? " Backend не надає часу знімка; свіжість джерела невідома." : " Поріг застарілості: 6 хвилин."}
  </p>;
}
