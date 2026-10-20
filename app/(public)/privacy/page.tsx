import Link from "next/link";
import type { Metadata } from "next";

import { PublicLegalFooter } from "../_components/public-legal-footer";
import { PublicSiteHeader } from "../_components/public-site-header";
import { PUBLIC_SITE_NAME, getPublicContactEmail } from "@/lib/public-site-config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Datenschutzerklärung für die öffentliche Website ${PUBLIC_SITE_NAME} mit Angaben zu Hosting, Kontaktanfragen, Cookies und Reichweitenmessung mit Umami.`,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `Datenschutzerklärung | ${PUBLIC_SITE_NAME}`,
    description: `Datenschutzerklärung für die öffentliche Website ${PUBLIC_SITE_NAME} mit Angaben zu Hosting, Kontaktanfragen, Cookies und Reichweitenmessung mit Umami.`,
    url: "/privacy",
  },
};

const contactEmail = getPublicContactEmail();

export default function PrivacyPage() {
  return (
    <>
      <PublicSiteHeader sectionLinkPrefix="/" />
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-semibold text-slate-900">Datenschutzerklärung</h1>
      <p className="mt-4 text-sm leading-6 text-slate-700">
        Stand: Oktober 2026
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">1. Verantwortlicher</h2>
          <p className="mt-3">
            Valerii Serputko, Gudrunstraße 134, 44319 Dortmund, Deutschland
          </p>
          <p className="mt-3">
            E-Mail:{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p className="mt-3">
            Weitere Angaben im{" "}<Link className="underline underline-offset-2" href="/impressum">Impressum</Link>{" "}(/impressum). Einen Datenschutzbeauftragten habe ich nicht benannt, weil keine gesetzliche Pflicht besteht.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">2. Hosting und Server-Logfiles</h2>
          <p className="mt-3">
            Die Website läuft auf meinem Server bei der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland. Der Server steht in Nürnberg. Mit Hetzner besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.
          </p>
          <p className="mt-3">
            Beim Aufruf der Website verarbeitet der Server: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Referrer, Browser und Betriebssystem, Statuscode und Datenmenge.
          </p>
          <p className="mt-3">
            Zweck: Auslieferung der Website, Fehlersuche und Schutz vor Angriffen.
          </p>
          <p className="mt-3">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </p>
          <p className="mt-3">
            Speicherdauer: Server-Logfiles werden nach 14 Tagen automatisch gelöscht.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">3. Statistik mit Umami</h2>
          <p className="mt-3">
            Ich nutze Umami. Umami läuft auf meinem eigenen Server bei Hetzner in Nürnberg. Daten gehen nicht an Dritte.
          </p>
          <p className="mt-3">
            Umami setzt keine Cookies und speichert nichts in deinem Browser. Die IP-Adresse wird nicht gespeichert.
          </p>
          <p className="mt-3">
            Erfasst werden: aufgerufene Seite, Referrer, Browser, Betriebssystem, Gerätetyp, Bildschirmgröße, Sprache, ungefähres Land und Region sowie Klicks auf Links zu Telegram, YouTube und Amazon und Ereignisse im Quiz und im Kontaktformular. Inhalte aus dem Formular werden nicht erfasst.
          </p>
          <p className="mt-3">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse ist, die Website anhand anonymer Statistiken zu verbessern. Eine Einwilligung nach § 25 TDDDG ist nicht nötig, weil nichts auf deinem Gerät gespeichert oder ausgelesen wird.
          </p>
          <p className="mt-3">
            Speicherdauer: 24 Monate.
          </p>
          <p className="mt-3">
            Frühere Statistik: Bis zur Umstellung im Herbst 2026 habe ich eine eigene Statistik verwendet. Sie ist abgeschaltet. Die Daten werden spätestens bis zum 28.02.2027 gelöscht. Alte Einträge davon in deinem Browser löscht die Website beim nächsten Besuch automatisch.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">4. Kontaktformular und E-Mail</h2>
          <p className="mt-3">
            Im Kontaktformular gibst du Name, Kontaktweg (z. B. E-Mail oder Telegram) und Angaben zu deiner Anfrage ein. Die Angaben werden auf meinem Server bei Hetzner gespeichert. Nur ich habe Zugriff. Sie werden nicht an Dritte weitergegeben.
          </p>
          <p className="mt-3">
            E-Mails empfange ich über Gmail. Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Dabei können Daten an die Google LLC in den USA übermittelt werden. Google LLC ist nach dem EU-US Data Privacy Framework zertifiziert (Art. 45 DSGVO). Datenschutz von Google:{" "}<a className="underline underline-offset-2" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>
          </p>
          <p className="mt-3">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, wenn deine Anfrage auf Unterricht oder eine Kooperation zielt; sonst Art. 6 Abs. 1 lit. f DSGVO.
          </p>
          <p className="mt-3">
            Speicherdauer: Anfragen aus dem Formular werden 6 Monate nach der letzten Bearbeitung automatisch gelöscht, außer eine gesetzliche Pflicht verlangt eine längere Aufbewahrung.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">5. Externe Links</h2>
          <p className="mt-3">
            Die Website enthält Links zu Telegram, YouTube und Amazon. Beim Besuch meiner Website wird von diesen Diensten nichts geladen. Erst wenn du auf einen Link klickst, verlässt du meine Website. Dann gilt der Datenschutz des jeweiligen Anbieters.
          </p>
          <p className="mt-3">
            Telegram: Telegram FZ-LLC, Dubai, Vereinigte Arabische Emirate. Für die VAE gibt es keinen Angemessenheitsbeschluss der EU. Datenschutz:{" "}<a className="underline underline-offset-2" href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer">https://telegram.org/privacy</a>
          </p>
          <p className="mt-3">
            YouTube: Google Ireland Limited, Dublin. Datenschutz:{" "}<a className="underline underline-offset-2" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a>
          </p>
          <p className="mt-3">
            Amazon: Amazon Europe Core S.à r.l., 38 Avenue John F. Kennedy, L-1855 Luxemburg. Es sind keine Affiliate-Links.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">6. Speicherung im Browser</h2>
          <p className="mt-3">
            Die Website setzt keine Cookies zu Werbe- oder Statistikzwecken. Gespeichert wird nur, was das Quiz braucht:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Cookie „quiz_teaser_scope“ (30 Tage): eine zufällige Kennung für das Tageslimit des Quiz. Sie wird an meinen Quiz-Server bei Hetzner in Nürnberg übermittelt.</li>
            <li>Local Storage „quiz_arena_five_question_progress_v1“: dein Fortschritt im Quiz. Er bleibt nur in deinem Browser, bis du ihn löschst.</li>
          </ul>
          <p className="mt-3">
            Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG und Art. 6 Abs. 1 lit. f DSGVO.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">7. Empfänger</h2>
          <p className="mt-3">
            Empfänger sind Hetzner (Hosting) und Google (E-Mail). Ich verkaufe keine Daten und gebe sie nicht zu Werbezwecken weiter.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">8. Keine automatisierte Entscheidung</h2>
          <p className="mt-3">
            Ich nutze keine automatisierte Entscheidungsfindung und kein Profiling nach Art. 22 DSGVO.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">9. Deine Rechte</h2>
          <p className="mt-3">
            Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Schreib mir an{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
          <p className="mt-3">
            Du kannst dich bei einer Aufsichtsbehörde beschweren (Art. 77 DSGVO). Zuständig ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf:{" "}<a className="underline underline-offset-2" href="https://www.ldi.nrw.de/kontakt/ihre-beschwerde" target="_blank" rel="noopener noreferrer">https://www.ldi.nrw.de/kontakt/ihre-beschwerde</a>
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">10. Widerspruchsrecht nach Art. 21 DSGVO</h2>
          <blockquote className="mt-3 border-l-4 border-slate-300 pl-4">
            <p>Wenn ich deine Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO verarbeite, kannst du aus Gründen deiner besonderen Situation jederzeit widersprechen. Dann verarbeite ich deine Daten nicht mehr, außer ich kann zwingende schutzwürdige Gründe nachweisen oder die Verarbeitung dient Rechtsansprüchen. Eine formlose E-Mail an{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>{" "}genügt.</p>
          </blockquote>
        </article>
      </section>
        <PublicLegalFooter />
      </main>
    </>
  );
}
