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
      <p className="mt-4 text-sm leading-6 text-slate-700">
        Diese Datenschutzerklärung gilt für die Website{" "}<strong className="font-semibold text-slate-900">deutschmit.de</strong>{" "}(„Deutsch ist einfach!“) mit ihren Informations- und Artikelseiten, dem Kontaktbereich und dem öffentlichen Quiz-Teaser. Ich betreibe die Website als Einzelperson. Deshalb schreibe ich hier in der Ich-Form.
      </p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">1. Verantwortlicher</h2>
          <p className="mt-3">
            Verantwortlich im Sinne von Art. 4 Nr. 7 DSGVO ist:
          </p>
          <p className="mt-3">
            Valerii Serputko, Gudrunstraße 134, 44319 Dortmund, Deutschland
          </p>
          <p className="mt-3">
            E-Mail:{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p className="mt-3">
            Weitere Angaben findest du im{" "}<Link className="underline underline-offset-2" href="/impressum">Impressum</Link>. Einen Datenschutzbeauftragten habe ich nicht benannt, weil dazu keine gesetzliche Pflicht besteht.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">2. Hosting und Server-Logfiles</h2>
          <p className="mt-3">
            Die Website läuft auf einem eigenen virtuellen Server bei der{" "}<strong className="font-semibold text-slate-900">Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland</strong>. Der Server steht im Rechenzentrum von Hetzner in{" "}<strong className="font-semibold text-slate-900">Nürnberg, Deutschland</strong>.{" "}Mit Hetzner besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.
          </p>
          <p className="mt-3">
            Alle Daten der Website, einschließlich der Datenbank-Backups, werden nur auf diesem Server gespeichert.
          </p>
          <p className="mt-3">
            Wenn du die Website aufrufst, verarbeitet der Server technisch notwendige Daten:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>IP-Adresse,</li>
            <li>Datum und Uhrzeit des Aufrufs,</li>
            <li>aufgerufene Seite oder Datei,</li>
            <li>Referrer (die zuvor besuchte Seite), soweit dein Browser ihn sendet,</li>
            <li>Browser und Betriebssystem (User-Agent),</li>
            <li>HTTP-Statuscode und übertragene Datenmenge.</li>
          </ul>
          <p className="mt-3">
            Ohne diese Daten kann die Website nicht ausgeliefert werden. Außerdem brauche ich sie, um Fehler zu finden und Angriffe abzuwehren. Für die Begrenzung von Formular- und Anmeldeversuchen wird die IP-Adresse kurzzeitig nur als Hashwert (mit einem zufälligen, nur im Arbeitsspeicher gehaltenen Schlüssel) im Arbeitsspeicher gehalten (etwa eine Minute) und nicht gespeichert.
          </p>
          <p className="mt-3">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse liegt in der sicheren und stabilen Bereitstellung der Website.
          </p>
          {/* Server-Logfiles werden nach [OFFEN: Speicherdauer Server-Logfiles] gelöscht. */}
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">3. Reichweitenmessung mit Umami</h2>
          <p className="mt-3">
            Um zu verstehen, welche Seiten und Angebote genutzt werden, setze ich{" "}<strong className="font-semibold text-slate-900">Umami</strong>{" "}ein. Umami ist eine Open-Source-Software, die ich{" "}<strong className="font-semibold text-slate-900">selbst auf meinem Server bei Hetzner in Nürnberg</strong>{" "}betreibe. Die Daten werden nicht an Umami oder andere Dritte übermittelt.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Was erfasst wird:</strong>
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>aufgerufene Seite (ohne Suchparameter und ohne Teile nach „#“),</li>
            <li>Referrer (von welcher Website du kommst),</li>
            <li>Browser, Betriebssystem, Gerätetyp, Bildschirmgröße und Sprache,</li>
            <li>ungefährer Standort (Land, ggf. Region und Stadt), abgeleitet aus der IP-Adresse,</li>
            <li>Klicks auf bestimmte Elemente, z. B. Links zu Telegram, YouTube und Amazon, Start, Ende und Fehler beim Quiz sowie Öffnen, erfolgreiches Absenden und Fehler beim Kontaktformular. Inhalte, die du ins Formular eingibst, werden dabei{" "}<strong className="font-semibold text-slate-900">nicht</strong>{" "}erfasst.</li>
          </ul>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Wie es funktioniert:</strong>
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Umami setzt{" "}<strong className="font-semibold text-slate-900">keine Cookies</strong>{" "}und speichert{" "}<strong className="font-semibold text-slate-900">nichts</strong>{" "}in deinem Browser (kein Local Storage, kein Session Storage). Das Skript prüft lediglich, ob du die Messung über den Eintrag „umami.disabled“ im Local Storage selbst abgeschaltet hast, und beachtet diesen Wunsch.</li>
            <li>Deine IP-Adresse wird{" "}<strong className="font-semibold text-slate-900">nicht gespeichert</strong>. Der Server bildet aus IP-Adresse, Browserkennung und einem geheimen Zufallswert (Salt) einen Hashwert, um Aufrufe innerhalb eines Besuchs zusammenzufassen. Der Salt wird jeden Monat gewechselt. Danach lassen sich neue Besuche nicht mehr mit älteren verbinden.</li>
            <li>Ich kann dich mit diesen Daten nicht identifizieren und führe sie nicht mit anderen Daten zusammen.</li>
            <li>Bereiche, für die eine Anmeldung nötig ist (Admin-Bereich), werden nicht gemessen.</li>
          </ul>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Rechtsgrundlage:</strong>{" "}Art. 6 Abs. 1 lit. f DSGVO. Mein berechtigtes Interesse ist es, die Website und meine Lernangebote anhand anonymisierter Nutzungsstatistiken zu verbessern und zu sehen, welche Inhalte hilfreich sind.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Keine Einwilligung nach § 25 TDDDG:</strong>{" "}§ 25 Abs. 1 TDDDG verlangt eine Einwilligung, wenn Informationen in deinem Endgerät gespeichert oder dort bereits gespeicherte Informationen ausgelesen werden. Umami speichert keine Informationen auf deinem Gerät und setzt keine Kennung, über die du wiedererkannt werden könntest. Die einzige Abfrage auf deinem Gerät ist die Prüfung, ob du der Messung widersprochen hast; sie dient allein dazu, deinen Widerspruch zu beachten (§ 25 Abs. 2 Nr. 2 TDDDG). Übertragen werden nur die Angaben, die dein Browser beim Aufruf einer Website ohnehin mitsendet oder die für die Darstellung der Seite nötig sind. Die Auswertung erfolgt ausschließlich auf meinem Server. Deshalb frage ich hierfür keine Einwilligung ab.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Speicherdauer:</strong>{" "}Die Umami-Statistiken werden 24 Monate gespeichert und danach gelöscht.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Widerspruch:</strong>{" "}Du kannst der Messung jederzeit widersprechen (siehe Abschnitt 11), z. B. formlos per E-Mail. Außerdem blockieren viele Browser-Erweiterungen (z. B. Werbe- und Trackingblocker) das Umami-Skript.
          </p>
          {/* **Frühere Website-Analytics:** Bis [OFFEN: Datum] habe ich eine eigene Statistik mit zufälligen Browser- und Sitzungskennungen im Browser verwendet. Diese Messung ist abgeschaltet. Die bis dahin erfassten Daten werden bis [OFFEN: Datum] endgültig gelöscht. Alte Einträge dieser Statistik in deinem Browser (Local und Session Storage) löscht die Website beim nächsten Besuch automatisch; es werden dabei keine neuen Daten gespeichert. */}
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">4. Kontaktformular und Kontakt per E-Mail</h2>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Kontaktformular.</strong>{" "}Auf der Website gibt es zwei Formulare: eine Anfrage für{" "}<strong className="font-semibold text-slate-900">Lernende</strong>{" "}und eine für{" "}<strong className="font-semibold text-slate-900">Kooperationspartner</strong>. Abgefragt werden:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><em>Lernende:</em>{" "}Name, Deutschniveau, Lernziele, gewünschtes Format, bevorzugte Zeiten, Häufigkeit, Kontaktmöglichkeit (z. B. Telegram-Benutzername oder E-Mail-Adresse); freiwillig: Budgetrahmen und eine Nachricht.</li>
            <li><em>Kooperationspartner:</em>{" "}Name bzw. Organisation, Art der Organisation, Land/Stadt, Anzahl der Lernenden, Art des Angebots, Kontaktmöglichkeit, Beschreibung der Idee und gewünschter Starttermin; freiwillig: Website oder Social-Media-Profil.</li>
          </ul>
          <p className="mt-3">
            Pflichtfelder sind alle Felder, die nicht als „optional“ markiert sind. Ohne sie kann ich deine Anfrage nicht bearbeiten. Du bist weder gesetzlich noch vertraglich verpflichtet, mir diese Daten zu geben; ohne sie ist aber keine Antwort möglich. Mit dem Absenden buchst du nichts.
          </p>
          <p className="mt-3">
            Die Angaben werden in einer Datenbank auf meinem Server bei Hetzner in Nürnberg gespeichert. Nur ich habe Zugriff darauf. Sie werden nicht per E-Mail oder Messenger weitergeleitet und nicht an Dritte übermittelt. Wenn ich dir antworte, nutze ich den Kontaktweg, den du angegeben hast (E-Mail oder Telegram; für Telegram gilt Abschnitt 5).
          </p>
          <p className="mt-3">
            Ein verstecktes Feld im Formular dient nur der Abwehr von Spam-Bots.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">E-Mail.</strong>{" "}Wenn du mir eine E-Mail schreibst, verarbeite ich deine E-Mail-Adresse, deinen Namen (falls angegeben) und den Inhalt deiner Nachricht. Für E-Mails nutze ich derzeit ein privates Postfach bei Google (Gmail). Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Google verarbeitet die E-Mails nach seinen eigenen Bedingungen; dabei können Daten auch an die Google LLC in den USA übermittelt werden. Google LLC ist nach dem EU-US Data Privacy Framework zertifiziert; die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO). Datenschutzerklärung von Google:{" "}<a className="underline underline-offset-2" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Rechtsgrundlage:</strong>{" "}Art. 6 Abs. 1 lit. b DSGVO, wenn deine Anfrage auf einen Vertrag (z. B. Unterricht oder Kooperation) zielt; sonst Art. 6 Abs. 1 lit. f DSGVO, wegen meines berechtigten Interesses, Anfragen zu beantworten.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Speicherdauer:</strong>{" "}Anfragen aus dem Kontaktformular werden 6 Monate nach der letzten Bearbeitung automatisch gelöscht, außer eine gesetzliche Aufbewahrungspflicht verlangt eine längere Speicherung (z. B. steuerliche Pflichten, wenn daraus ein Vertrag entsteht).
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">5. Telegram und andere externe Links</h2>
          <p className="mt-3">
            Auf der Website findest du Links zu externen Diensten. Beim bloßen Besuch meiner Website werden{" "}<strong className="font-semibold text-slate-900">keine Daten</strong>{" "}an diese Dienste übertragen; es werden keine Inhalte, Skripte oder Schriften von ihnen geladen. Erst wenn du auf einen Link klickst, verlässt du meine Website. Dann erhält der jeweilige Anbieter Daten wie deine IP-Adresse und gegebenenfalls die Information, von welcher Seite du kommst. Für die Verarbeitung dort ist der jeweilige Anbieter verantwortlich. Ob ein Link angeklickt wurde, erfasse ich mit Umami (Abschnitt 3).
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Telegram.</strong>{" "}Viele Links führen zu Telegram:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Quiz-Bot „Deutsch Quiz Arena“: t.me/Deine_Deutsch_Quiz_bot</li>
            <li>Deutsch-Trainer-Bot: t.me/Trainer1512_bot</li>
            <li>Telegram-Kanal: t.me/doechkurse</li>
          </ul>
          <p className="mt-3">
            Telegram wird von der Telegram FZ-LLC (Dubai, Vereinigte Arabische Emirate) bzw. der Telegram Messenger Inc. betrieben. Für die VAE gibt es keinen Angemessenheitsbeschluss der EU. Ein vergleichbares Datenschutzniveau ist dort also nicht gesichert. Informationen findest du in der Datenschutzerklärung von Telegram:{" "}<a className="underline underline-offset-2" href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer">telegram.org/privacy</a>
          </p>
          <p className="mt-3">
            Die Telegram-Bots betreibe ich selbst. Wenn du einen Bot nutzt, verarbeite ich dort z. B. deine Telegram-ID, deinen Anzeigenamen und deine Quiz-Ergebnisse.{" "}{/* Details dazu stehen in der gesonderten Datenschutzerklärung für die Bots: [OFFEN: Telegram-Bot-Datenschutz] */}
          </p>
          <p className="mt-3">
            Die Zahlen auf der Startseite (z. B. Anzahl der Nutzer und gespielten Quizze) sind zusammengefasste Werte aus den Bots und enthalten keine personenbezogenen Daten.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Amazon.</strong>{" "}Meine Bücher („Deutsch für Elektriker“, Print und Kindle-eBook) verkaufe ich über Amazon. Die Links führen zu amazon.de, betrieben von der Amazon Europe Core S.à r.l. und weiteren Amazon-Gesellschaften, 38 Avenue John F. Kennedy, L-1855 Luxemburg. Es sind keine Partnerlinks (Affiliate-Links). Kauf, Zahlung und Versand laufen vollständig über Amazon. Datenschutzerklärung von Amazon:{" "}<a className="underline underline-offset-2" href="https://www.amazon.de/gp/help/customer/display.html?nodeId=201909010" target="_blank" rel="noopener noreferrer">amazon.de – Datenschutzerklärung</a>
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">YouTube.</strong>{" "}Ein Link im Bereich „Lernangebote“ der Startseite führt zu meinem YouTube-Kanal „Komm mit auf Deutsch“ (<a className="underline underline-offset-2" href="https://www.youtube.com/@KommmitaufDeutsch" target="_blank" rel="noopener noreferrer">youtube.com/@KommmitaufDeutsch</a>). Auf meiner Website sind keine YouTube-Videos eingebettet; YouTube wird erst aufgerufen, wenn du auf diesen Link klickst. YouTube wird von der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, betrieben. Dabei können Daten auch an Google LLC in den USA übermittelt werden; Google ist nach dem EU-US Data Privacy Framework zertifiziert. Datenschutzerklärung von Google:{" "}<a className="underline underline-offset-2" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">6. Technisch notwendige Speicherung im Browser</h2>
          <p className="mt-3">
            Die Website setzt{" "}<strong className="font-semibold text-slate-900">keine Cookies oder Speicherungen zu Werbe- oder Statistikzwecken</strong>. Gespeichert wird nur, was für eine Funktion nötig ist, die du selbst nutzt:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><strong className="font-semibold text-slate-900">Cookie „quiz_teaser_scope“</strong>{" "}(nur vom Server lesbar, 30 Tage): enthält eine zufällige Kennung, damit das tägliche Limit des Quiz-Teasers (5 Fragen pro Tag) eingehalten und Missbrauch begrenzt wird. Es wird nur gesetzt, wenn du den Quiz-Teaser nutzt und die Fragen dafür von meinem Server geladen werden.</li>
            <li><strong className="font-semibold text-slate-900">Local Storage „quiz_arena_five_question_progress_v1“</strong>{" "}(bis du ihn im Browser löschst): speichert deinen Fortschritt im Quiz-Teaser (aktuelle Runde, Datum, Punktestand), damit du nach dem Neuladen weitermachen kannst. Er bleibt nur in deinem Browser und wird nicht an mich übertragen.</li>
            <li><strong className="font-semibold text-slate-900">Cookies „site_admin_session“ und „quiz_arena_session“</strong>{" "}(8 Stunden bzw. bis zur Abmeldung{/*  [OFFEN: Dauer quiz_arena_session prüfen] */}): Anmeldung im Admin-Bereich. Sie betreffen nur mich als Betreiber, nicht Besucherinnen und Besucher.</li>
          </ul>
          <p className="mt-3">
            Die zufällige Kennung aus dem Quiz-Cookie wird für die Begrenzung an meinen Quiz-Server übermittelt, von dem die Fragen kommen. Er läuft ebenfalls bei Hetzner in Nürnberg.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Rechtsgrundlage:</strong>{" "}Für das Speichern und Auslesen auf deinem Gerät § 25 Abs. 2 Nr. 2 TDDDG, weil es unbedingt erforderlich ist, um die von dir ausdrücklich gewünschte Funktion bereitzustellen. Für die weitere Verarbeitung Art. 6 Abs. 1 lit. f DSGVO, wegen meines berechtigten Interesses an einer funktionierenden und missbrauchssicheren Website.
          </p>
          <p className="mt-3">
            Du kannst Cookies und den Local Storage jederzeit in deinem Browser löschen. Dann beginnt der Quiz-Teaser neu.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">7. Empfänger und Übermittlung in Drittländer</h2>
          <p className="mt-3">
            Empfänger deiner Daten sind ich selbst und Hetzner als technischer Dienstleister (Auftragsverarbeiter). Für E-Mails kommt Google hinzu (Abschnitt 4). Andere Empfänger gibt es nicht. Ich verkaufe keine Daten und gebe sie nicht zu Werbezwecken weiter.
          </p>
          <p className="mt-3">
            Eine Übermittlung in Länder außerhalb der EU findet durch meine Website nicht statt. Ausnahmen: E-Mails an mein Gmail-Postfach (Abschnitt 4) und Dienste, zu denen du über einen Link selbst wechselst, z. B. Telegram oder YouTube (Abschnitt 5).
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">8. Speicherdauer im Überblick</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {/* Server-Logfiles: [OFFEN: Speicherdauer Server-Logfiles]. */}
            <li>Umami-Statistiken: 24 Monate; IP-Adressen werden nicht gespeichert, der Salt für den Hashwert wechselt monatlich.</li>
            <li>Kontaktanfragen aus dem Formular: automatische Löschung 6 Monate nach der letzten Bearbeitung, außer bei gesetzlicher Aufbewahrungspflicht.</li>
            <li>Cookie „quiz_teaser_scope“: 30 Tage.</li>
            <li>Quiz-Fortschritt im Local Storage: bis du ihn im Browser löschst.</li>
            <li>Admin-Sitzung: 8 Stunden.</li>
            {/* Datenbank-Backups: [OFFEN: Aufbewahrung der Backups auf dem VPS prüfen], nur auf dem Server. */}
            {/* Daten der früheren Website-Analytics: Löschung bis [OFFEN: Datum]. */}
          </ul>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">9. Keine automatisierte Entscheidungsfindung</h2>
          <p className="mt-3">
            Ich nutze keine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO.
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">10. Deine Rechte</h2>
          <p className="mt-3">
            Du hast nach der DSGVO folgende Rechte:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><strong className="font-semibold text-slate-900">Auskunft</strong>{" "}über die Daten, die ich über dich verarbeite (Art. 15 DSGVO),</li>
            <li><strong className="font-semibold text-slate-900">Berichtigung</strong>{" "}unrichtiger Daten (Art. 16 DSGVO),</li>
            <li><strong className="font-semibold text-slate-900">Löschung</strong>{" "}(Art. 17 DSGVO),</li>
            <li><strong className="font-semibold text-slate-900">Einschränkung der Verarbeitung</strong>{" "}(Art. 18 DSGVO),</li>
            <li><strong className="font-semibold text-slate-900">Datenübertragbarkeit</strong>{" "}(Art. 20 DSGVO),</li>
            <li><strong className="font-semibold text-slate-900">Widerspruch</strong>{" "}gegen die Verarbeitung (Art. 21 DSGVO, siehe Abschnitt 11).</li>
          </ul>
          <p className="mt-3">
            Schreib mir dafür einfach eine E-Mail an{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Ich antworte in der Regel innerhalb eines Monats.
          </p>
          <p className="mt-3">
            <strong className="font-semibold text-slate-900">Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO).</strong>{" "}Wenn du meinst, dass die Verarbeitung deiner Daten gegen die DSGVO verstößt, kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Für mich zuständig ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf:{" "}<a className="underline underline-offset-2" href="https://www.ldi.nrw.de/kontakt/ihre-beschwerde" target="_blank" rel="noopener noreferrer">ldi.nrw.de/kontakt/ihre-beschwerde</a>
          </p>
        </article>

        <article className="rounded-xl border border-white/70 bg-white/80 p-5">
          <h2 className="text-base font-semibold text-slate-900">11. Widerspruchsrecht nach Art. 21 DSGVO</h2>
          <blockquote className="mt-3 border-l-4 border-slate-300 pl-4">
            <p><strong className="font-semibold text-slate-900">Wenn ich deine Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) verarbeite, hast du das Recht, aus Gründen, die sich aus deiner besonderen Situation ergeben, jederzeit Widerspruch gegen diese Verarbeitung einzulegen.</strong>{" "}Das betrifft insbesondere die Server-Logfiles (Abschnitt 2), die Reichweitenmessung mit Umami (Abschnitt 3), Kontaktanfragen, die nicht auf einen Vertrag zielen (Abschnitt 4), und die Verarbeitung im Rahmen des Quiz-Teasers (Abschnitt 6).</p>
            <p className="mt-3"><strong className="font-semibold text-slate-900">Nach einem Widerspruch verarbeite ich deine Daten nicht mehr, außer ich kann zwingende schutzwürdige Gründe nachweisen, die deine Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.</strong></p>
            <p className="mt-3">Für den Widerspruch genügt eine formlose E-Mail an{" "}<a className="font-medium text-slate-900 underline underline-offset-2" href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
          </blockquote>
        </article>
      </section>
        <PublicLegalFooter />
      </main>
    </>
  );
}
