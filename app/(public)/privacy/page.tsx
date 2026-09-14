import Link from "next/link";
import type { Metadata } from "next";

import { PublicLegalFooter } from "../_components/public-legal-footer";
import { PublicSiteHeader } from "../_components/public-site-header";
import { PUBLIC_SITE_NAME, getPublicContactEmail } from "@/lib/public-site-config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Datenschutzerklärung für die öffentliche Website ${PUBLIC_SITE_NAME} mit Angaben zu Hosting, Kontaktanfragen, Cookies und Website-Analytics.`,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `Datenschutzerklärung | ${PUBLIC_SITE_NAME}`,
    description: `Datenschutzerklärung für die öffentliche Website ${PUBLIC_SITE_NAME} mit Angaben zu Hosting, Kontaktanfragen, Cookies und Website-Analytics.`,
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
        Stand: 13. September 2026. Diese Datenschutzerklärung gilt für die öffentliche Website{" "}
        {PUBLIC_SITE_NAME} mit ihren Informationsseiten, Artikelseiten, dem Kontaktbereich und dem
        öffentlichen Quiz-Teaser.
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">1. Verantwortlicher</h2>
          <div className="mt-3">
            <p>Verantwortlich im Sinne von Art. 4 Nr. 7 DSGVO ist:</p>
            <p className="mt-3 font-medium text-slate-900">Valerii Serputko</p>
            <p>Gudrunstraße 134</p>
            <p>44319 Dortmund</p>
            <p>Deutschland</p>
            <p className="mt-3">
              Weitere Kontaktangaben findest du im{" "}
              <Link className="underline underline-offset-2" href="/impressum">
                Impressum
              </Link>{" "}
              und auf der{" "}
              <Link className="underline underline-offset-2" href="/contact">
                Kontaktseite
              </Link>
              .
            </p>
            <p className="mt-3">
              Du erreichst uns per E-Mail unter{" "}
              <a
                className="font-medium text-slate-900 underline underline-offset-2"
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
              .
            </p>
          </div>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            2. Hosting und technische Server-Protokolle
          </h2>
          <p className="mt-3">
            Die Website wird auf einer eigenbetriebenen Infrastruktur bei Hetzner Online GmbH in
            Deutschland gehostet.
          </p>
          <p className="mt-3">
            Beim Aufruf der Website werden technisch erforderliche Server-Protokolle verarbeitet.
            Dazu gehören insbesondere IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Referrer,
            Browser-Informationen sowie sicherheitsrelevante Statusdaten. Diese Verarbeitung ist
            erforderlich, um die Website sicher und stabil bereitzustellen.
          </p>
          <p className="mt-3">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse liegt in
            der sicheren Bereitstellung, Fehleranalyse und Missbrauchsabwehr.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">3. Kontaktanfragen</h2>
          <p className="mt-3">
            Wenn du uns per E-Mail kontaktierst, verarbeite ich deine E-Mail-Adresse, die von dir
            angegebenen Kontaktdaten und den Inhalt deiner Nachricht, soweit dies zur Bearbeitung
            deiner Anfrage erforderlich ist. Dasselbe gilt für Angaben, die du über eine der
            separaten Projektanfragen für Lernende oder Kooperationspartner sendest.
          </p>
          <p className="mt-3">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit es um die Anbahnung oder
            Bearbeitung einer konkreten Anfrage geht. Im Übrigen erfolgt die Verarbeitung auf
            Grundlage von Art. 6 Abs. 1 lit. f DSGVO wegen des berechtigten Interesses an einer
            geordneten Kommunikation.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            4. Cookies und Website-Analytics
          </h2>
          <p className="mt-3">
            Für den Quiz-Teaser wird ein technisch notwendiges Cookie gesetzt. Es dient dazu, die
            Funktion des Quiz-Teasers bereitzustellen und Missbrauch zu begrenzen.
          </p>
          <p className="mt-3">
            Website-Analytics startet standardmäßig beim Besuch der Website. Wir verwenden die
            Daten, um Seitenaufrufe, Klicks und Quiz- sowie Anfrageergebnisse zu verstehen.
            Du kannst die Erfassung jederzeit unter „Analytics-Einstellungen“ im Footer deaktivieren.
            Eine bereits gespeicherte Ablehnung wird berücksichtigt.
          </p>
          <p className="mt-3">
            Rechtsgrundlage für das technisch notwendige Cookie ist Art. 6 Abs. 1 lit. f DSGVO
            sowie, soweit anwendbar, § 25 Abs. 2 TDDDG.
          </p>
          <p className="mt-3">
            Wir erfassen bei aktiver Analytics Seitenaufrufe, Seitenwechsel und Klicks auf
            wichtige Links (etwa Telegram, Amazon und Downloads), sichtbare Angebote sowie Beginn und Ende einer Quizrunde. Dazu verwenden wir zufällige Browser-, Tab-Sitzungs- und
            Seitenaufruf-Kennungen, Zeitpunkte, bekannte Seitenpfade und die Reihenfolge der
            Ereignisse. Eine Sitzung gehört zu einem Tab; nach 30 Minuten ohne Aktivität beginnt
            bei der nächsten Aktion eine neue Sitzung.
          </p>
          <p className="mt-3">
            Wir übermitteln außerdem eine Schätzung der aktiven Zeit, erreichte Scrollschwellen und eine ungefähre Kennzeichnung gelesener Artikel. Bei Anfragen erfassen wir Öffnen, Absenden, feste Fehlercodes und nach erfolgreicher Speicherung eine zufällige Bestätigungskennung. Formularinhalte und die Kennung der gespeicherten Anfrage werden dabei nicht übertragen. Eine Analytics-Störung verhindert das Speichern deiner Anfrage nicht; in der Statistik kann die Bestätigung dann fehlen. Als Herkunft speichern wir nur den externen
            Hostnamen und bereinigte allgemeine Kampagnenbezeichnungen (UTM). Vollständige URLs,
            Suchparameter, Formulareingaben, Fehlertexte, Tasten und Mausbewegungen werden nicht
            als Analytics-Ereignisse gespeichert. IP-Adressen dienen nur kurzzeitig der Begrenzung
            von Anfragen und werden nicht in den Analytics-Datensätzen gespeichert.
          </p>
          <p className="mt-3">
            Die Verarbeitung erfolgt in unserer eigenen Infrastruktur. Bei deaktivierter Analytics
            werden keine Analytics-Kennungen angelegt und keine Ereignisse für eine spätere
            Übermittlung gesammelt. Deine Einstellung wird getrennt im Browser gespeichert. Blockiertes
            Browserspeichern oder Verbindungsfehler können die Messung verhindern; die Website
            bleibt nutzbar. Die Statistik bildet nur tatsächlich übermittelte Beobachtungen ab.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">5. Speicherdauer</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Technisch notwendiges Quiz-Teaser-Cookie: bis zu 30 Tage.
            </li>
            <li>
              Analytics-Ereignisse: 90 Tage. Browser-Kennung: ebenfalls 90 Tage. Beim nächsten
              erfassten Ereignis nach Ablauf dieser Zeit wird sie erneuert. Sitzungsdaten werden
              im jeweiligen Tab gespeichert. Nicht übermittelte
              Ereignisse bleiben höchstens fünf Minuten im Arbeitsspeicher der Seite.
            </li>
            <li>
              Kontaktanfragen: 6 Monate nach der letzten Bearbeitung, sofern keine gesetzliche
              oder sonstige berechtigte Aufbewahrungspflicht eine längere Speicherung erfordert.
            </li>
            <li>
              Betriebsprotokolle dienen dem Betrieb und der Fehleranalyse. Datenbank-Backups
              werden 14 Tage aufbewahrt.
            </li>
          </ul>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            6. Empfänger und Verarbeitung durch Dienstleister
          </h2>
          <p className="mt-3">
            Empfänger deiner Daten sind in erster Linie der Verantwortliche selbst und die für den
            Betrieb dieser Website eingesetzten technischen Systeme.
          </p>
          <p className="mt-3">
            Das Hosting erfolgt bei Hetzner Online GmbH in Deutschland. Für die öffentliche
            Website ist derzeit kein separater externer Backup- oder Monitoring-Dienst
            dokumentiert.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">7. Deine Rechte</h2>
          <p className="mt-3">
            Du hast nach Maßgabe der DSGVO insbesondere das Recht auf Auskunft, Berichtigung,
            Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen
            Verarbeitungen, die auf Art. 6 Abs. 1 lit. f DSGVO beruhen.
          </p>
          <p className="mt-3">
            Du kannst Website-Analytics jederzeit mit Wirkung für die
            Zukunft unter „Analytics-Einstellungen“ im Footer jeder öffentlichen Seite
            deaktivieren. Die Deaktivierung stoppt die weitere Erfassung in den geöffneten Tabs und
            entfernt die Analytics-Kennungen sowie noch wartende Ereignisse im Browser.
            Bereits übermittelte Daten werden dadurch nicht automatisch gelöscht; eine Löschung
            kannst du über die oben genannte Kontaktadresse anfragen. Eine erneute Aktivierung
            beginnt mit neuen Kennungen ohne Verknüpfung zur vorherigen Sitzung.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">8. Beschwerderecht</h2>
          <p className="mt-3">
            Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, wenn du
            der Ansicht bist, dass die Verarbeitung deiner personenbezogenen Daten gegen die DSGVO
            verstößt. Zuständig am Sitz des Verantwortlichen ist insbesondere die Landesbeauftragte
            für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.
          </p>
          <p className="mt-3">
            Informationen und Beschwerdemöglichkeiten findest du unter{" "}
            <a
              className="underline underline-offset-2"
              href="https://www.ldi.nrw.de/kontakt/ihre-beschwerde"
              target="_blank"
              rel="noopener noreferrer"
            >
              ldi.nrw.de/kontakt/ihre-beschwerde
            </a>
            .
          </p>
        </article>
      </section>
        <PublicLegalFooter />
      </main>
    </>
  );
}
