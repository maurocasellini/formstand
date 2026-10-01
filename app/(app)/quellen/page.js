import Link from "next/link";
import { viewerAndSubject } from "@/lib/subject";
import * as repo from "@/lib/repo";
import { appConfigured } from "@/lib/apps";
import { PROVIDERS } from "@/lib/providers";
import { baseUrl } from "@/lib/baseurl";
import { syncNow, disconnect, loadDemo, removeDemo, fullResync, connectIntervals } from "../../actions-data";
import ActionForm from "@/components/ActionForm";
import GarminImport from "@/components/GarminImport";
import SyncButton from "@/components/SyncButton";

const LINKABLE = ["Garmin", "WHOOP", "Polar", "Oura", "Zwift", "Wahoo", "COROS", "Suunto", "Amazfit", "Huawei", "Google Fit", "Concept2"];
const EXTRA = [PROVIDERS.strava, PROVIDERS.whoop];
const EXTRA_WHY = {
  strava: "Nur falls Workouts ausschliesslich auf Strava landen (z. B. ohne eigene Uhr). Doppelte Einheiten werden zusammengeführt.",
  whoop: "Zusätzlich Strain und Recovery-Score. Nicht nötig, wenn WHOOP schon in intervals.icu hängt – sonst zählt der Schlaf doppelt.",
};
const when = (d) => (d ? new Date(d).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }) : "noch nie");

export default async function Quellen({ searchParams }) {
  const sp = await searchParams;
  const { subject, viewer, own: isOwn } = await viewerAndSubject();
  const own = isOwn && !viewer.demo;
  const conns = await repo.getConnections(subject.id);
  const [acts, daily] = await Promise.all([repo.getActivities(subject.id), repo.getDaily(subject.id)]);
  const demo = { n: acts.filter((a) => a.is_demo).length + daily.filter((d) => d.is_demo).length };
  const readyMap = { intervals: true, strava: await appConfigured("strava"), whoop: await appConfigured("whoop") };
  const base = await baseUrl();
  const by = Object.fromEntries(conns.map((c) => [c.provider, c]));
  const iv = by.intervals;
  const extraOpen = Boolean(by.strava || by.whoop);
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Quellen</h1><p>Eine Quelle für alles: intervals.icu. Danach läuft der Abgleich automatisch jeden Morgen.</p></div>
        <div className="btnrow"><SyncButton action={syncNow} /><Link className="btn ghost" href="/heute">Zur Übersicht</Link></div></div>
      {!viewer.demo && !conns.length && <div className="notice good">Neu hier? Verbinde deine Uhr in intervals.icu und dann intervals.icu hier – die <Link href="/anleitung#garmin">Schritt-für-Schritt-Anleitung</Link> erklärt jeden Klick.</div>}
      {viewer.demo && <div className="notice warn">In der Demo stammen die Daten von Beispiel-Geräten (Garmin, WHOOP, Strava). Mit eigenem Konto verbindest du hier deine echten Apps.</div>}
      {sp?.ok && <div className="notice good">{sp.ok}</div>}
      {sp?.error && <div className="notice crit">{sp.error}</div>}
      <section className="panel main-src">
        <div className="panel-head"><h2>Hauptquelle: intervals.icu</h2>
          {iv ? <span className={`tag ${iv.last_error ? "err" : "on"}`}>{iv.last_error ? "Fehler" : "verbunden"}</span> : <span className="tag next">noch nicht verbunden</span>}</div>
        <p className="muted">Formstand holt alles über intervals.icu. Dort verbindest du einmal alle deine Uhren und Apps – Formstand bekommt dann automatisch Workouts, HRV, Ruhepuls, Schlaf, Bereitschaft, SpO2, Gewicht und Schritte.</p>
        <div className="grid2e">
          <div>
            <h3>1 · In intervals.icu verbinden, was du nutzt</h3>
            <p className="srcs">{LINKABLE.map((x) => <span key={x} className="tag">{x}</span>)}</p>
            <p className="note">In intervals.icu unter <a href="https://intervals.icu/settings" target="_blank" rel="noreferrer">Einstellungen</a> → beim jeweiligen Dienst auf <b>Verbinden</b>. Bei Garmin die Wellness-Daten erlauben.</p>
            <p className="note"><b>Strava:</b> Einheiten, die nur über Strava nach intervals.icu kommen, gibt intervals.icu nicht weiter (Strava verbietet das). Darum Uhr bzw. Zwift direkt in intervals.icu verbinden. Ältere Strava-Einheiten: in intervals.icu „Import All Strava Data“ nutzen, dann sind sie ebenfalls verfügbar.</p>
          </div>
          <div>
            <h3>2 · intervals.icu mit Formstand verbinden</h3>
            {iv && <p>Letzter Abgleich: {when(iv.last_sync_at)}{iv.last_error ? ` · ${iv.last_error}` : ""}</p>}
            {iv && !viewer.demo && <form action={disconnect}><input type="hidden" name="provider" value="intervals" /><button className="btn danger sm" type="submit">Trennen</button></form>}
            {!iv && own && (
              <ActionForm action={connectIntervals} className="stack" submit="Verbinden">
                <label className="f">API-Schlüssel<input type="password" name="key" required autoComplete="off" /></label>
                <label className="f">Athleten-ID (optional)<input type="text" name="athlete" placeholder="i123456" autoComplete="off" /></label>
                <p className="note">Zu finden auf <a href="https://intervals.icu/settings" target="_blank" rel="noreferrer">intervals.icu/settings</a> ganz unten unter <b>Entwicklereinstellungen</b> (Developer Settings). <Link href="/anleitung#garmin">Schritt für Schritt</Link></p>
              </ActionForm>
            )}
            {!iv && !own && !viewer.demo && <p>Verbinden kann nur die Person selbst.</p>}
          </div>
        </div>
      </section>
      <details className="panel more" open={extraOpen}>
        <summary>Weitere Verbindungen <span className="note">meist nicht nötig</span></summary>
        <section className="cards">
          {EXTRA.map((p) => {
            const c = by[p.id], ready = Boolean(readyMap[p.id]);
            return (
              <div key={p.id} className="card">
                <div className="t">{p.name}
                  {c ? <span className={`tag ${c.last_error ? "err" : "on"}`}>{c.last_error ? "Fehler" : "verbunden"}</span>
                    : ready ? <span className="tag next">bereit</span> : <span className="tag wait">noch nicht freigeschaltet</span>}
                </div>
                <p>{EXTRA_WHY[p.id]}</p>
                {c && <p>Letzter Abgleich: {when(c.last_sync_at)}{c.last_error ? ` · ${c.last_error}` : ""}</p>}
                {!c && ready && own && <a className="btn ghost" href={`/api/connect/${p.id}`}>Mit {p.name} verbinden</a>}
                {!c && ready && !own && !viewer.demo && <p>Verbinden kann nur die Person selbst.</p>}
                {c && !viewer.demo && <form action={disconnect}><input type="hidden" name="provider" value={p.id} /><button className="btn danger sm" type="submit">Trennen</button></form>}
                {!ready && <p className="note">Noch nicht freigeschaltet. {p.setup}</p>}
              </div>
            );
          })}
        </section>
        <h3>Garmin-Datenexport (ganze Historie)</h3>
        <div className="grid2e">
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Auf <b>connect.garmin.com</b> anmelden → Profilbild → <b>Kontoeinstellungen</b> → <b>Datenverwaltung</b> → <b>Daten exportieren</b>.</li>
            <li>Garmin schickt nach einigen Stunden bis Tagen einen Download-Link per E-Mail.</li>
            <li>Die ZIP-Datei hier auswählen. Sie wird im Browser entpackt, nur die Daten werden hochgeladen.</li>
          </ol>
          {own ? <GarminImport /> : <p className="muted">Den Import macht die Person selbst.</p>}
        </div>
        <p className="note">Nur nötig für Jahre vor intervals.icu oder für Body Battery und Stress. Übernommen werden u. a. Schlafphasen, Body Battery, Stress, HRV, Ruhepuls, SpO2, Training Readiness, VO2max, Gewicht und alle Workouts.</p>
      </details>
      <section className="grid2e">
        <div className="panel">
          <h2>Neu laden</h2>
          <p className="muted">Holt die letzten 12 Monate aller verbundenen Quellen nochmals ab, z. B. nach einem neuen FTP-Test (Last wird neu berechnet).</p>
          <form action={fullResync}><button className="btn ghost" type="submit">12 Monate neu laden</button></form>
        </div>
        <div className="panel">
          <h2>Beispieldaten</h2>
          <p className="muted">{demo.n ? `${demo.n.toLocaleString("de-CH")} Beispiel-Datensätze sind geladen. Sie sind markiert und lassen sich jederzeit entfernen.` : "Zwei Jahre erfundene Daten zum Ausprobieren des Dashboards."}</p>
          <div className="btnrow">
            {!demo.n && <form action={loadDemo}><button className="btn ghost" type="submit">Beispieldaten laden</button></form>}
            {demo.n > 0 && <form action={removeDemo}><button className="btn danger" type="submit">Beispieldaten löschen</button></form>}
          </div>
        </div>
      </section>
    </>
  );
}
