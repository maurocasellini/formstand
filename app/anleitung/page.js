import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { baseUrl } from "@/lib/baseurl";

export const metadata = { title: "Formstand – Anleitung", description: "Schritt für Schritt: Konto, Uhr und Apps über intervals.icu, Erinnerung, Ziele, Körper und Alltag." };

// Bausteine: Schritt mit Nummer und Zeitbedarf, Teilschritt, Hinweis-Kasten
function Step({ n, id, title, time, children }) {
  return (
    <section className="g-step" id={id}>
      <div className="g-num" aria-hidden="true">{n}</div>
      <div className="g-card">
        <header><h2>{title}</h2>{time && <span className="g-time">{time}</span>}</header>
        <div className="g-body">{children}</div>
      </div>
    </section>
  );
}
const Sub = ({ k, title, children }) => (
  <div className="g-sub"><div className="g-sub-h">{k && <span>{k}</span>}<b>{title}</b></div>{children}</div>
);
const Tip = ({ tone = "info", children }) => <div className={`g-tip ${tone}`}>{children}</div>;

const TOC = [
  ["Einrichten", [["konto", "1", "Konto anlegen"], ["app", "2", "Aufs Handy"], ["garmin", "3", "Uhr & Apps verbinden"], ["push", "4", "Morgen-Erinnerung"]]],
  ["Loslegen", [["ziele", "5", "Ziele & Wettkämpfe"], ["tests", "6", "Tests"], ["koerper", "7", "Körper"], ["taeglich", "8", "Jeden Tag & Tagebuch"]]],
  ["Optional", [["historie", "A", "Garmin-Historie"], ["strava", "B", "Strava & WHOOP direkt"]]],
  ["Hilfe", [["hilfe", "?", "Häufige Fragen"], ["admin", "⚙", "Für den Admin"]]],
];

export default async function Anleitung() {
  const base = await baseUrl();
  const host = base.replace(/^https?:\/\//, "");
  return (
    <>
      <header className="bar">
        <div className="bar-in"><div className="bar-top">
          <Link href="/" className="logo"><Logo /><b>Formstand</b></Link>
          <div className="who"><ThemeToggle /><Link className="btn ghost sm" href="/demo">Demo</Link><Link className="btn ghost sm" href="/login">Anmelden</Link><Link className="btn sm" href="/register">Konto anlegen</Link></div>
        </div></div>
      </header>

      <main className="g-wrap">
        <section className="g-hero">
          <span className="g-kicker">Anleitung</span>
          <h1>In 15 Minuten startklar</h1>
          <p>Einmal einrichten, danach läuft alles automatisch: Jeden Morgen holt Formstand deine Daten, du checkst in 5 Sekunden ein und bekommst die Entscheidung für den Tag.</p>
          <div className="g-facts">
            <span><b>15 min</b> einmalig</span><span><b>10 s</b> pro Tag</span><span><b>gratis</b> inkl. intervals.icu</span>
          </div>
          <div className="btnrow"><Link className="btn" href="/register">Konto anlegen</Link><Link className="btn ghost" href="/demo">Erst die Demo ansehen</Link></div>
        </section>

        <div className="g-layout">
          <nav className="g-toc" aria-label="Inhalt">
            {TOC.map(([grp, items]) => (
              <div key={grp} className="g-toc-g"><span>{grp}</span>
                {items.map(([id, n, t]) => <a key={id} href={`#${id}`}><i>{n}</i>{t}</a>)}
              </div>
            ))}
          </nav>

          <div className="g-main">
            <h2 className="g-part">Einrichten</h2>

            <Step n="1" id="konto" title="Konto anlegen" time="1 Minute">
              <ol>
                <li>Öffne <Link href="/register"><b>{host}/register</b></Link>.</li>
                <li>Benutzername, Name und ein Passwort mit mindestens 8 Zeichen wählen → <b>Konto anlegen</b>.</li>
              </ol>
              <Tip>Hat dir der Admin schon ein Konto angelegt? Dann mit Benutzername und Startpasswort unter <Link href="/login">Anmelden</Link> einloggen – Formstand verlangt danach ein eigenes Passwort.</Tip>
            </Step>

            <Step n="2" id="app" title="Formstand aufs Handy" time="1 Minute">
              <p>Formstand ist eine Web-App. Als Symbol auf dem Home-Bildschirm funktioniert sie wie eine normale App – inklusive Mitteilungen.</p>
              <div className="g-two">
                <Sub title="iPhone"><p>{host} in <b>Safari</b> öffnen → <b>Teilen</b> (Quadrat mit Pfeil) → <b>Zum Home-Bildschirm</b> → Hinzufügen.</p></Sub>
                <Sub title="Android"><p>In <b>Chrome</b> öffnen → Menü <b>⋮</b> → <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.</p></Sub>
              </div>
              <Tip>Ab jetzt Formstand immer über das Symbol öffnen.</Tip>
            </Step>

            <Step n="3" id="garmin" title="Uhr und Apps verbinden – über intervals.icu" time="5–10 Minuten">
              <p>Garmin öffnet seine Schnittstelle nur für Firmen. Der Weg führt deshalb über <b>intervals.icu</b> – kostenlos und bei Ausdauersportlern verbreitet. Dort hängst du alle Geräte an, Formstand holt dann alles gesammelt ab: Schlaf, HRV, Ruhepuls, Gewicht und alle Einheiten.</p>
              <Sub k="a" title="Konto bei intervals.icu">
                <p>Auf <a href="https://intervals.icu" target="_blank" rel="noreferrer">intervals.icu</a> ein Gratis-Konto erstellen.</p>
              </Sub>
              <Sub k="b" title="Uhr und Apps in intervals.icu verbinden">
                <ol>
                  <li>In intervals.icu auf <b>Einstellungen</b> (Settings).</li>
                  <li>Bei <b>Garmin Connect</b> auf <b>Verbinden</b> → mit dem Garmin-Login anmelden → Zugriff erlauben.</li>
                  <li>Gleich dort weitere Dienste anhängen, die du nutzt: <b>WHOOP, Polar, Oura, Zwift, Wahoo, COROS, Suunto</b> …</li>
                </ol>
                <Tip tone="warn"><b>Wichtig:</b> Bei Garmin auch die <b>Wellness-Daten</b> (Schlaf, HRV, Ruhepuls) erlauben – sonst fehlt die Erholung.</Tip>
              </Sub>
              <Sub k="c" title="API-Schlüssel kopieren">
                <ol>
                  <li><a href="https://intervals.icu/settings" target="_blank" rel="noreferrer">intervals.icu/settings</a> öffnen und ganz nach unten zu <b>Entwicklereinstellungen</b> (Developer Settings) scrollen.</li>
                  <li>Beim <b>API-Schlüssel</b> auf <b>Generieren</b> bzw. <b>Anzeigen</b> tippen und ihn kopieren.</li>
                </ol>
                <p className="note">Der Schlüssel ist wie ein Passwort: nur in Formstand einfügen. Die Athleten-ID (beginnt mit „i“) ist optional.</p>
              </Sub>
              <Sub k="d" title="In Formstand einfügen">
                <p>Formstand → <b>Quellen</b> → bei intervals.icu den Schlüssel einfügen → <b>Verbinden</b>. Formstand lädt sofort die letzten 12 Monate, danach jeden Morgen automatisch die neuen Daten.</p>
              </Sub>
              <Tip><b>Strava</b> in intervals.icu bringt Formstand nichts: Einheiten, die nur über Strava kommen, darf intervals.icu nicht weitergeben. Darum Uhr und Zwift direkt verbinden. Für ältere Strava-Einheiten gibt es in intervals.icu „Import All Strava Data“.</Tip>
            </Step>

            <Step n="4" id="push" title="Morgen-Erinnerung einschalten" time="30 Sekunden">
              <ol>
                <li>Formstand <b>über das Symbol</b> auf dem Home-Bildschirm öffnen (auf dem iPhone geht Push nur so).</li>
                <li>Oben auf deinen Namen → <b>Konto</b> → <b>Erinnerung auf diesem Gerät aktivieren</b> → Mitteilungen erlauben.</li>
                <li>Mit <b>Test senden</b> prüfen. Ab morgen kommt gegen 7 Uhr die Erinnerung mit dem Vorschlag des Tages.</li>
              </ol>
            </Step>

            <h2 className="g-part">Loslegen</h2>

            <Step n="5" id="ziele" title="Ziele, Wettkämpfe und Schwächen" time="5 Minuten">
              <Sub k="1" title="Meine Ziele: was bis wann?">
                <p><b>Ziele & Plan → Meine Ziele → + Neues Ziel:</b> Messgrösse wählen (Gewicht, Körperfett, Muskelmasse, FTP, jeder Test – oder ein freies Ziel), <b>Zielwert</b> und <b>Zieldatum</b> setzen. Der Startwert kommt aus deinen letzten Messungen.</p>
                <ul>
                  <li>Beispiele: <i>Körpergewicht 76 kg bis 30.06.</i> · <i>Kniebeuge 140 kg (1RM geschätzt) bis Ende Jahr</i> · <i>5 km unter 21:30 bis April</i>.</li>
                  <li>Ein <b>Abnehmziel</b> stellt die Ernährung auf das nötige Tempo ein (max. 1 % pro Woche). Ein <b>Kraft-, Lauf- oder FTP-Ziel</b> setzt Fokus-Einheiten im Wochenplan. Die <b>KI</b> bezieht sich in jeder Empfehlung darauf.</li>
                  <li>Auf der <b>Übersicht</b> zeigt „Deine Ziele · auf Kurs?“ Fortschritt, Status und was pro Woche noch nötig ist. Montags kommt der Stand auch als Push.</li>
                </ul>
              </Sub>
              <Sub k="2" title="Fokus, Schwächen & Zeit">
                <ol>
                  <li><b>Hauptziel</b> wählen: Leistung, Form halten, Abnehmen, Muskelaufbau oder Gesundheit.</li>
                  <li>Bis zu 4 <b>Schwächen</b> antippen und die wichtigste festlegen – oder die Vorschläge aus Tests und Körperanalyse übernehmen.</li>
                  <li><b>Trainingstage</b>, <b>Stunden pro Woche</b> und den <b>Tag für die lange Einheit</b> eintragen → Speichern.</li>
                </ol>
              </Sub>
              <Sub k="3" title="Wettkampf suchen">
                <p>Namen ins Suchfeld, z. B. „ATHX St. Gallen“ → <b>Suchen</b>. Formstand findet Datum, Format und Kategorien und fragt nach, welche du startest. Dann die Priorität wählen: <b>A</b> = Saisonhöhepunkt mit Tapering, <b>B</b> = wichtig, <b>C</b> = läuft als Training mit.</p>
              </Sub>
              <Sub k="4" title="Woche an dein Leben anpassen">
                <p>Formstand schlägt die Woche vor – bei jedem Tag auf <b>Anpassen</b>: anders trainieren (z. B. Ausfahrt mit Buddy), mit anderem Tag tauschen, nur begrenzt Zeit oder Ruhetag. Mit <b>jede Woche so</b> wird es ein fester Termin. Verpasste harte Einheiten verschiebt Formstand selbst.</p>
              </Sub>
            </Step>

            <Step n="6" id="tests" title="Tests" time="einmal pro 6–10 Wochen">
              <p>Unter <b>Tests</b> trägst du ein, was du gemessen hast – oder lädst einen Screenshot/PDF hoch, die KI liest die Werte aus.</p>
              <div className="g-two">
                <Sub title="Ausdauer-Diagnostik"><p>FTP (z. B. Zwift Ramp Test), Schwellenpuls (Garmin, Labor), VO2max, CSS fürs Schwimmen. Daraus werden Watt-, Puls- und Pace-Bereiche.</p></Sub>
                <Sub title="Maximalkraft"><p>Kreuzheben, Kniebeuge, Frontkniebeuge, Bankdrücken, Schulterdrücken, Push Press – mit <b>1–5 Wiederholungen</b>, kein 1RM-Test nötig. Formstand schätzt das 1RM.</p></Sub>
                <Sub title="Lauf & Rudern"><p>400 m, 800 m, 1 km, 5 km, Cooper-Test, Norwegian 4×4, Rudern 500/2000 m, SkiErg 1000 m. Zeit als m:ss, die Pace rechnet Formstand.</p></Sub>
                <Sub title="Grundlagenfitness"><p>Burpees und Wall Balls auf Zeit (1–10 min), Liegestütz, Klimmzüge, Plank, Standweitsprung.</p></Sub>
              </div>
              <Sub title="Wo die Tests einfliessen">
                <ul>
                  <li><b>Zonen:</b> Watt-, Puls- und Pace-Vorgaben in jeder Einheit und in der Entscheidung für heute.</li>
                  <li><b>Arbeitsgewichte:</b> Krafteinheiten im Wochenplan mit konkreten Gewichten, z. B. „Kniebeuge 4×5 @ 100 kg“.</li>
                  <li><b>Fitness-Profil:</b> Jede Leistung wird eingestuft (Einsteiger bis Elite, Normen für Männer/Frauen). Die schwächsten Bereiche erscheinen als „Daran arbeiten wir“ – mit einem Klick in die Ziele.</li>
                  <li><b>Ziele:</b> Test-Ziele messen ihren Fortschritt an deinen Tests.</li>
                  <li><b>KI:</b> Tagesempfehlung und Körperanalyse kennen Testwerte und Stufen.</li>
                </ul>
              </Sub>
              <Tip>Ausgeruht testen, nach einem lockeren Tag, immer unter ähnlichen Bedingungen. Bei jedem Test steht, wann der nächste fällig ist.</Tip>
            </Step>

            <Step n="7" id="koerper" title="Körper" time="alle 2–4 Wochen">
              <Sub title="Hochladen"><p><b>Körper → Hochladen:</b> InBody-Auswertung (PDF oder Foto) und Körperfotos ins selbe Feld – Formstand erkennt selbst, was es ist, liest InBody-Werte aus und ordnet Fotos nach Pose. Gewicht, Körperfett und Grösse trägst du daneben unter <b>Gewicht & Grösse</b> ein (Waage und InBody kommen automatisch).</p></Sub>
              <Sub title="KI-Coach: dein Körper"><p>Nach jedem Foto- oder InBody-Upload macht die KI eine Gesamtanalyse: Körperfett geschätzt, was gut ist, wo Potenzial liegt, <b>Entwicklung seit dem ersten Foto</b> und der passende Trainingsfokus. Mit <b>Analyse neu durchführen</b> jederzeit aktualisieren; frühere Analysen bleiben im Verlauf.</p></Sub>
              <Sub title="Entwicklung & Aufräumen"><p>Unter <b>Körperentwicklung</b> stehen Messwerte und Fotos pro Datum nebeneinander, dazu der Vorher/Nachher-Vergleich. Fotos und Dateien lassen sich direkt löschen, auch ein ganzer Tag.</p></Sub>
              <Tip>Körperfotos morgens nüchtern, gleiches Licht, gleicher Abstand – Front, Seite, Rücken.</Tip>
            </Step>

            <Step n="8" id="taeglich" title="Jeden Tag & Tagebuch" time="10 Sekunden">
              <div className="g-day">
                <div><span>Morgens</span><p>Uhr synchronisieren, in Formstand einchecken (Energie, Motivation, Stress, Muskelkater, Zeit) und die <b>Entscheidung für heute</b> lesen. Darüber siehst du, ob deine Ziele auf Kurs sind.</p></div>
                <div><span>Nach dem Training</span><p>Bei <b>Wie hart war's?</b> die Anstrengung antippen. Einheiten ohne Uhr unter <b>Tagebuch → Training nachtragen</b>.</p></div>
                <div><span>Einflussfaktoren</span><p>Alkohol (Gläser), spätes Essen, Stress, Sauna, Mobility … im <b>Tagebuch</b> antippen – auch rückwirkend für jedes Datum. Formstand lernt daraus, wie du am Morgen danach reagierst.</p></div>
              </div>
            </Step>

            <h2 className="g-part">Optional</h2>

            <Step n="A" id="historie" title="Die ganze Garmin-Historie" time="5 Minuten + Wartezeit">
              <p>intervals.icu liefert die letzten Monate. Für Jahre an Daten:</p>
              <ol>
                <li>Am Computer auf <a href="https://connect.garmin.com" target="_blank" rel="noreferrer">connect.garmin.com</a> → Profilbild → <b>Kontoeinstellungen</b> → <b>Datenverwaltung</b> → <b>Daten exportieren</b>.</li>
                <li>Garmin schickt nach Stunden bis Tagen einen Link per E-Mail → ZIP herunterladen.</li>
                <li>Formstand → <b>Quellen → Weitere Verbindungen → Garmin-Datenexport</b> → ZIP auswählen.</li>
              </ol>
            </Step>

            <Step n="B" id="strava" title="Strava oder WHOOP direkt" time="1 Minute">
              <ul>
                <li><b>Strava</b> nur, wenn Workouts ausschliesslich dort landen: Quellen → Weitere Verbindungen → <b>Mit Strava verbinden</b>.</li>
                <li><b>WHOOP direkt</b> liefert zusätzlich Strain und Recovery – nicht nötig, wenn WHOOP schon in intervals.icu hängt.</li>
              </ul>
              <Tip>Steht „noch nicht freigeschaltet“, muss der Admin das einmalig erledigen. Doppelte Einheiten erkennt Formstand und zählt sie nur einmal.</Tip>
            </Step>

            <section className="g-card g-faq" id="hilfe">
              <h2>Häufige Fragen</h2>
              {[
                ["intervals.icu lässt sich nicht verbinden", "API-Schlüssel ohne Leerzeichen kopieren; die Athleten-ID leer lassen oder mit „i“ am Anfang eingeben. Notfalls in intervals.icu einen neuen Schlüssel erzeugen."],
                ["Einheiten sind da, aber keine Erholung/HRV", "In intervals.icu bei der Garmin-Verbindung die Wellness-Daten erlauben. Die Uhr nachts tragen; Garmin braucht für den HRV-Status rund drei Wochen."],
                ["Die Werte von heute fehlen", "Garmin-App öffnen und synchronisieren, kurz warten, dann in Formstand unter Quellen „Jetzt abgleichen“."],
                ["Keine Mitteilungen auf dem iPhone", "Formstand muss als Symbol auf dem Home-Bildschirm installiert und von dort geöffnet sein (iOS 16.4 oder neuer). In den iPhone-Einstellungen Mitteilungen für Formstand erlauben."],
                ["Wer sieht meine Daten?", "Nur du, der Admin und ein Coach, dem du zugeordnet bist. Zugangsdaten zu anderen Diensten werden verschlüsselt gespeichert. Verbindungen lassen sich unter Quellen jederzeit trennen."],
              ].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
            </section>

            <details className="g-card g-admin" id="admin">
              <summary><h2>Für den Admin – einmalig</h2><span className="note">Strava, WHOOP, KI, Leute einladen</span></summary>
              <ul>
                <li><b>Strava freischalten:</b> auf <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a> eine App anlegen (Website {base}, <b>Authorization Callback Domain: <span className="num">{host}</span></b>). Client ID und Secret unter <b>Admin → Schnittstellen</b> eintragen.</li>
                <li><b>WHOOP freischalten:</b> auf <a href="https://developer.whoop.com" target="_blank" rel="noreferrer">developer.whoop.com</a> eine App anlegen, Redirect-URL <span className="num">{base}/api/oauth/whoop</span>, alle read-Scopes und offline aktivieren. Client ID/Secret im Admin eintragen.</li>
                <li><b>KI (optional):</b> Claude-API-Schlüssel in Vercel als Umgebungsvariable <span className="num">ANTHROPIC_API_KEY</span> (sensitive), Modelle und Monatslimit unter Admin → Schnittstellen.</li>
                <li><b>Leute einladen:</b> Im Admin steht ein fertiger Einladungstext mit allen Links zum Kopieren.</li>
              </ul>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
