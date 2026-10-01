import Link from "next/link";
import Logo from "@/components/Logo";
import { baseUrl } from "@/lib/baseurl";

export const metadata = { title: "Formstand – Anleitung", description: "Schritt für Schritt: Konto, Garmin über intervals.icu, Strava, WHOOP, Erinnerung, Ziele." };

function Step({ n, id, title, time, children }) {
  return (
    <section className="panel step" id={id}>
      <div className="step-h"><span className="step-n">{n}</span><h2>{title}</h2>{time && <span className="note">{time}</span>}</div>
      <div className="step-b">{children}</div>
    </section>
  );
}

export default async function Anleitung() {
  const base = await baseUrl();
  const host = base.replace(/^https?:\/\//, "");
  return (
    <>
      <header className="bar">
        <div className="bar-in"><div className="bar-top">
          <Link href="/" className="logo"><Logo /><b>Formstand</b></Link>
          <div className="who"><Link className="btn ghost sm" href="/demo">Demo</Link><Link className="btn ghost sm" href="/login">Anmelden</Link><Link className="btn sm" href="/register">Konto anlegen</Link></div>
        </div></div>
      </header>
      <main className="wrap guide">
        <div className="head"><div style={{ display: "grid", gap: 4 }}>
          <h1>So richtest du Formstand ein</h1>
          <p>Dauert etwa 15 Minuten. Danach läuft alles automatisch: jeden Morgen holt Formstand deine Daten, du checkst in 5 Sekunden ein und bekommst die Entscheidung für den Tag.</p>
        </div></div>

        <nav className="toc panel">
          <b>Übersicht</b>
          <ol>
            <li><a href="#konto">Konto anlegen</a></li><li><a href="#app">Formstand aufs Handy</a></li><li><a href="#garmin">Garmin verbinden (über intervals.icu)</a></li>
            <li><a href="#historie">Optional: ganze Garmin-Historie</a></li><li><a href="#strava">Strava, Zwift und WHOOP</a></li><li><a href="#push">Morgen-Erinnerung</a></li>
            <li><a href="#ziele">Ziele, Wettkämpfe, Schwächen</a></li><li><a href="#tests">Tests und Körperwerte</a></li><li><a href="#taeglich">Was du täglich machst</a></li>
          </ol>
          <p className="note">Probleme? <a href="#hilfe">Häufige Fragen</a> · Admin? <a href="#admin">Einmalige Einrichtung</a></p>
        </nav>

        <Step n="1" id="konto" title="Konto anlegen" time="1 Minute">
          <ol>
            <li>Öffne <b>{host}/register</b> (<Link href="/register">hier</Link>).</li>
            <li>Benutzername, Name und ein Passwort mit mindestens 8 Zeichen wählen, „Konto anlegen“.</li>
            <li>Hat dir der Admin schon ein Konto angelegt: mit Benutzername und Startpasswort unter <Link href="/login">Anmelden</Link> einloggen. Formstand verlangt dann ein eigenes Passwort.</li>
          </ol>
        </Step>

        <Step n="2" id="app" title="Formstand aufs Handy" time="1 Minute">
          <p>Formstand ist eine Web-App. Als Symbol auf dem Home-Bildschirm funktioniert sie wie eine normale App, inklusive Mitteilungen.</p>
          <ul>
            <li><b>iPhone:</b> {host} in <b>Safari</b> öffnen → unten auf <b>Teilen</b> (Quadrat mit Pfeil) → <b>Zum Home-Bildschirm</b> → Hinzufügen.</li>
            <li><b>Android:</b> in <b>Chrome</b> öffnen → Menü <b>⋮</b> → <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.</li>
          </ul>
          <p className="note">Ab jetzt Formstand immer über das Symbol öffnen.</p>
        </Step>

        <Step n="3" id="garmin" title="Uhr und Apps verbinden – über intervals.icu" time="5–10 Minuten">
          <p>Garmin gibt seine Schnittstelle nur Firmen. Der Weg führt deshalb über <b>intervals.icu</b>: kostenlos, seriös und bei Ausdauersportlern verbreitet. intervals.icu holt deine Daten von Garmin, Formstand holt sie von intervals.icu – Schlaf, HRV, Ruhepuls, Body Battery, Stress, VO2max und alle Aktivitäten.</p>
          <h3>a) Konto bei intervals.icu</h3>
          <ol>
            <li>Auf <a href="https://intervals.icu" target="_blank" rel="noreferrer">intervals.icu</a> ein Konto erstellen (mit E-Mail oder „mit Strava anmelden“).</li>
          </ol>
          <h3>b) Uhr und Apps mit intervals.icu verbinden</h3>
          <ol>
            <li>In intervals.icu links auf <b>Einstellungen</b> (Settings) gehen.</li>
            <li>Bei <b>Garmin Connect</b> auf <b>Verbinden</b> klicken, mit deinem Garmin-Login anmelden und den Zugriff erlauben. Wichtig: auch die <b>Wellness-Daten</b> (Schlaf, HFV/HRV, Ruhe-HF) erlauben, sonst fehlt die Bereitschaft.</li>
            <li>Gleich dort kannst du alles weitere anhängen, das du nutzt: <b>WHOOP, Polar, Oura, Zwift, Wahoo, COROS, Suunto</b> … Formstand bekommt dann alles gesammelt über intervals.icu. intervals.icu ist damit deine Hauptquelle.</li>
            <li><b>Strava in intervals.icu bringt Formstand nichts:</b> Einheiten, die nur über Strava kommen, darf intervals.icu nicht weitergeben. Darum Uhr und Zwift direkt verbinden. Für ältere Strava-Einheiten gibt es in intervals.icu „Import All Strava Data“ – danach sind sie auch für Formstand da.</li>
          </ol>
          <h3>c) API-Schlüssel in intervals.icu holen</h3>
          <ol>
            <li>Direkt öffnen: <a href="https://intervals.icu/settings" target="_blank" rel="noreferrer">intervals.icu/settings</a> (oder links auf <b>Einstellungen</b>).</li>
            <li>Ganz nach unten scrollen bis zum Abschnitt <b>Entwicklereinstellungen</b> (englisch <b>Developer Settings</b>), meist das letzte Feld der Seite.</li>
            <li>Dort steht die <b>Athleten-ID</b> (beginnt mit „i“, z. B. <span className="num">i123456</span>) und daneben der <b>API-Schlüssel</b>. Ist noch keiner da: auf <b>Generieren</b>/<b>Generate</b> klicken, sonst auf <b>Anzeigen</b>/<b>View</b>.</li>
            <li>Den API-Schlüssel kopieren. Er ist wie ein Passwort: nur in Formstand einfügen, nicht weitergeben. Die Athleten-ID ist optional – ohne sie nimmt Formstand automatisch dein eigenes Konto.</li>
          </ol>
          <h3>d) In Formstand einfügen</h3>
          <ol>
            <li>In Formstand auf <b>Quellen</b> gehen.</li>
            <li>Bei <b>intervals.icu</b> den <b>API-Schlüssel</b> (und optional die Athleten-ID) einfügen → <b>Verbinden</b>.</li>
            <li>Formstand lädt sofort die letzten 12 Monate (kann eine halbe Minute dauern). Danach holt es jeden Morgen automatisch die neuen Daten.</li>
          </ol>
          <p className="note">intervals.icu gibt es auf Deutsch und Englisch; die Bezeichnungen können sich leicht ändern, die Abschnitte heissen sinngemäss gleich. Strava lässt sich nicht über intervals.icu an Formstand weitergeben (Strava verbietet das) – wer Strava will, verbindet es in Formstand separat. Doppelte Einheiten erkennt Formstand und zählt sie nur einmal.</p>
        </Step>

        <Step n="4" id="historie" title="Optional: die ganze Garmin-Historie" time="5 Minuten + Wartezeit">
          <p>intervals.icu liefert die letzten Monate. Wer Jahre zurück will (z. B. für Trends und Trigger-Auswertungen):</p>
          <ol>
            <li>Auf <a href="https://connect.garmin.com" target="_blank" rel="noreferrer">connect.garmin.com</a> anmelden (am Computer).</li>
            <li>Profilbild → <b>Kontoeinstellungen</b> → <b>Datenverwaltung</b> → <b>Daten exportieren</b> → Export anfordern.</li>
            <li>Garmin schickt nach einigen Stunden bis Tagen einen Download-Link per E-Mail. ZIP herunterladen.</li>
            <li>In Formstand unter <b>Quellen → Weitere Verbindungen → Garmin-Datenexport</b> die ZIP-Datei auswählen. Sie wird im Browser entpackt, nur die Werte werden übertragen.</li>
          </ol>
        </Step>

        <Step n="5" id="strava" title="Optional: Strava separat" time="1 Minute">
          <ul>
            <li><b>Zwift, WHOOP, Polar, Oura &amp; Co.:</b> am einfachsten direkt in intervals.icu verbinden (Schritt 3). Dann ist hier nichts weiter nötig.</li>
            <li><b>Strava:</b> nur nötig, wenn Workouts <i>nur</i> auf Strava landen. Quellen → <b>Weitere Verbindungen</b> → <b>Mit Strava verbinden</b> → bei Strava anmelden → Zugriff erlauben. Doppelte Einheiten werden zusammengeführt.</li>
            <li><b>WHOOP direkt:</b> geht auch über Quellen → <b>Weitere Verbindungen</b> → <b>Mit WHOOP verbinden</b>, liefert zusätzlich Strain und Recovery. Nicht nötig, wenn WHOOP schon in intervals.icu hängt.</li>
          </ul>
          <p className="note">Steht bei Strava oder WHOOP „noch nicht freigeschaltet“, muss der Admin das einmalig erledigen (siehe unten).</p>
        </Step>

        <Step n="6" id="push" title="Morgen-Erinnerung einschalten" time="30 Sekunden">
          <ol>
            <li>Formstand <b>über das Symbol auf dem Home-Bildschirm</b> öffnen (auf dem iPhone geht Push nur so).</li>
            <li>Oben rechts auf deinen Namen → <b>Mein Konto</b> → <b>Erinnerung auf diesem Gerät aktivieren</b> → Mitteilungen erlauben.</li>
            <li>Mit <b>Test senden</b> prüfen. Ab morgen kommt jeden Morgen gegen 7 Uhr die Erinnerung mit dem Vorschlag des Tages.</li>
          </ol>
        </Step>

        <Step n="7" id="ziele" title="Ziele, Wettkämpfe und Schwächen" time="3 Minuten">
          <ol>
            <li>Auf <b>Ziele & Plan</b> gehen.</li>
            <li><b>Hauptziel</b> wählen (Leistung, Form halten, Abnehmen, Muskelaufbau, Gesundheit).</li>
            <li><b>Schwächen</b> anklicken, an denen du arbeiten willst (bis 4), und die wichtigste auswählen.</li>
            <li><b>Trainingstage</b>, <b>Stunden pro Woche</b> und den <b>Tag für die lange Einheit</b> eintragen (die längste ruhige Ausfahrt bzw. der lange Lauf, meist am Wochenende) → Speichern.</li>
            <li><b>Wettkämpfe</b>: Namen ins Suchfeld (z. B. „ATHX St. Gallen“) → <b>Suchen</b>. Formstand findet Datum, Format und Kategorien und fragt nach, welche du startest (z. B. Single oder Doubles). Dann Priorität wählen: A = Saisonhöhepunkt (voller Aufbau mit Tapering), B = wichtig, C = Training.</li>
          </ol>
          <p className="note">Daraus entsteht dein Wochenplan. Die Tagesentscheidung folgt ihm, solange dein Körper mitmacht.</p>
          <h3>Plan an dein Leben anpassen</h3>
          <ul>
            <li>Formstand schlägt die Woche vor, du passt an: bei einem Tag auf <b>Anpassen</b> – <b>Anders trainieren</b> (Vorschlag ist vorausgefüllt, z. B. auf „Ausfahrt mit Buddy“, hart, 120 min ändern), <b>Mit anderem Tag tauschen</b>, <b>Nur begrenzt Zeit</b> oder <b>Ruhetag</b>.</li>
            <li>Häkchen <b>jede Woche so</b> setzen, dann wird es ein fester Termin (z. B. jeden Dienstag Gruppenausfahrt). Der Plan baut die Woche darum herum.</li>
            <li>Training ohne Uhr gemacht? Unter <b>Eingaben → Training nachtragen</b> mit Dauer und Anstrengung eintragen.</li>
          </ul>
        </Step>

        <Step n="8" id="tests" title="Tests und Körperwerte" time="nach Bedarf">
          <ul>
            <li><b>Eingaben → Leistungstest:</b> FTP (z. B. Zwift Ramp Test), Schwellenpuls (Garmin-Laktatschwelle), CSS fürs Schwimmen. Damit bekommst du Watt-, Puls- und Pace-Vorgaben.</li>
            <li><b>Eingaben:</b> Gewicht, Profil (Sportart, Jahrgang).</li>
            <li><b>Körper:</b> InBody-Auswertung (PDF oder Foto vom Ausdruck) und Körperfotos im selben Feld hochladen – Formstand erkennt selbst, was es ist, liest die InBody-Werte aus und ordnet Fotos nach Pose. Unter „Körperentwicklung“ stehen Messwerte und Fotos pro Datum nebeneinander, dazu der Vorher/Nachher-Vergleich. Körperfotos alle 2–4 Wochen.</li>
          </ul>
        </Step>

        <Step n="9" id="taeglich" title="Was du täglich machst" time="10 Sekunden">
          <ol>
            <li><b>Morgens:</b> Uhr synchronisieren (Garmin-App kurz öffnen), dann in Formstand einchecken: Energie, Motivation, Stress, Muskelkater, Zeit für Training.</li>
            <li>Die <b>Entscheidung für heute</b> lesen – inklusive „nicht empfohlen“ und Ernährung.</li>
            <li><b>Nach dem Training:</b> bei „Wie hart war's?“ die Anstrengung antippen.</li>
            <li><b>Abends:</b> unter „Abend-Faktoren“ Alkohol (Gläser) und weitere Faktoren antippen – spät gegessen, Stress, Sauna, Mobility … Vergessen? Einfach ein früheres Datum wählen oder unter Eingaben die letzten 14 Abende auf einmal nachtragen. Formstand lernt daraus, wie du am Morgen danach reagierst.</li>
          </ol>
        </Step>

        <section className="panel" id="hilfe">
          <h2>Häufige Fragen</h2>
          <dl className="faq">
            <dt>intervals.icu lässt sich nicht verbinden</dt><dd>Athleten-ID mit „i“ am Anfang eingeben, API-Schlüssel ohne Leerzeichen kopieren. Notfalls in intervals.icu einen neuen Schlüssel erzeugen.</dd>
            <dt>Workouts sind da, aber keine Bereitschaft/HRV</dt><dd>In intervals.icu bei der Garmin-Verbindung die Wellness-Daten erlauben. Die Uhr nachts tragen; Garmin braucht für den HRV-Status rund drei Wochen.</dd>
            <dt>Die Werte von heute fehlen</dt><dd>Garmin-App öffnen und synchronisieren, kurz warten, dann in Formstand unter Quellen „Jetzt abgleichen“.</dd>
            <dt>Keine Mitteilungen auf dem iPhone</dt><dd>Formstand muss als Symbol auf dem Home-Bildschirm installiert und von dort geöffnet sein (iOS 16.4 oder neuer). In den iPhone-Einstellungen Mitteilungen für Formstand erlauben.</dd>
            <dt>Wer sieht meine Daten?</dt><dd>Nur du, der Admin und ein Coach, dem du zugeordnet bist. Zugangsdaten zu anderen Diensten werden verschlüsselt gespeichert. Verbindungen kannst du unter Quellen jederzeit trennen.</dd>
          </dl>
        </section>

        <section className="panel" id="admin">
          <h2>Für den Admin – einmalig</h2>
          <ul>
            <li><b>Strava freischalten:</b> auf <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a> eine App anlegen (Name z. B. „Formstand“, Website {base}, <b>Authorization Callback Domain: <span className="num">{host}</span></b>). Client ID und Client Secret in Formstand unter <b>Admin → Schnittstellen</b> eintragen.</li>
            <li><b>WHOOP freischalten:</b> auf <a href="https://developer.whoop.com" target="_blank" rel="noreferrer">developer.whoop.com</a> eine App anlegen, Redirect-URL <span className="num">{base}/api/oauth/whoop</span>, alle read-Scopes und offline aktivieren. Client ID/Secret im Admin eintragen.</li>
            <li><b>KI (optional):</b> Claude-API-Schlüssel in Vercel als Umgebungsvariable <span className="num">ANTHROPIC_API_KEY</span> (sensitive) hinterlegen, Modelle und Monatslimit unter Admin → Schnittstellen.</li>
            <li><b>Leute einladen:</b> Im Admin steht ein fertiger Einladungstext mit allen Links zum Kopieren.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
