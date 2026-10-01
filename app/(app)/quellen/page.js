import { viewerAndSubject } from "@/lib/subject";
import { q, one } from "@/lib/db";
import { PROVIDERS } from "@/lib/providers";
import { baseUrl } from "@/lib/baseurl";
import { syncNow, disconnect, loadDemo, removeDemo, fullResync, connectIntervals } from "../../actions-data";
import ActionForm from "@/components/ActionForm";
import GarminImport from "@/components/GarminImport";
import SyncButton from "@/components/SyncButton";

const when = (d) => (d ? new Date(d).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }) : "noch nie");

export default async function Quellen({ searchParams }) {
  const sp = await searchParams;
  const { subject, own } = await viewerAndSubject();
  const conns = await q("select provider, status, last_sync_at, last_error, created_at from connections where user_id=$1", [subject.id]);
  const demo = await one("select (select count(*) from activities where user_id=$1 and is_demo)::int + (select count(*) from daily_metrics where user_id=$1 and is_demo)::int as n", [subject.id]);
  const base = await baseUrl();
  const by = Object.fromEntries(conns.map((c) => [c.provider, c]));
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Quellen</h1><p>Verbundene Dienste liefern automatisch. Täglicher Abgleich um 06:15, Strava zusätzlich sofort bei jedem neuen Workout.</p></div>
        <SyncButton action={syncNow} /></div>
      {sp?.ok && <div className="notice good">{sp.ok}</div>}
      {sp?.error && <div className="notice crit">{sp.error}</div>}
      <section className="cards">
        {Object.values(PROVIDERS).map((p) => {
          const c = by[p.id], ready = p.configured();
          return (
            <div key={p.id} className="card">
              <div className="t">{p.name}
                {c ? <span className={`tag ${c.last_error ? "err" : "on"}`}>{c.last_error ? "Fehler" : "verbunden"}</span>
                  : p.id === "garmin" ? <span className="tag next">via intervals.icu</span>
                  : p.pendingApproval && !ready ? <span className="tag wait">Freigabe nötig</span>
                  : p.soon ? <span className="tag">folgt</span>
                  : ready ? <span className="tag next">bereit</span> : <span className="tag wait">einrichten</span>}
              </div>
              <p>{p.kind}</p>
              {c && <p>Letzter Abgleich: {when(c.last_sync_at)}{c.last_error ? ` · ${c.last_error}` : ""}</p>}
              {!c && ready && own && p.apiKey && (
                <ActionForm action={connectIntervals} className="stack" submit="Verbinden">
                  <label className="f">Athleten-ID<input type="text" name="athlete" placeholder="i123456" autoComplete="off" /></label>
                  <label className="f">API-Schlüssel<input type="password" name="key" required autoComplete="off" /></label>
                </ActionForm>
              )}
              {!c && ready && own && !p.apiKey && <a className="btn" href={`/api/connect/${p.id}`}>Mit {p.name} verbinden</a>}
              {!c && p.apiKey && <p className="note">{p.setup}</p>}
              {!c && ready && !own && <p>Verbinden kann nur die Person selbst.</p>}
              {c && <form action={disconnect}><input type="hidden" name="provider" value={p.id} /><button className="btn danger sm" type="submit">Trennen</button></form>}
              {!ready && <p className="note">{p.setup}</p>}
              {!ready && (p.id === "strava" || p.id === "whoop") && <p className="note num">Callback: {base}/api/oauth/{p.id}</p>}
            </div>
          );
        })}
        <div className="card">
          <div className="t">Zwift<span className="tag next">über Strava</span></div>
          <p>Zwift hat keine offene Schnittstelle. In Zwift „Strava“ und „Garmin Connect“ verknüpfen, dann kommen alle Fahrten hier an. Doppelte Einträge werden zusammengeführt.</p>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Garmin-Datenexport einlesen</h2><span className="note">alles, auch rückwirkend über Jahre</span></div>
        <div className="grid2e">
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Auf <b>connect.garmin.com</b> anmelden → Profilbild → <b>Kontoeinstellungen</b> → <b>Datenverwaltung</b> → <b>Daten exportieren</b>.</li>
            <li>Garmin schickt nach einigen Stunden bis Tagen einen Download-Link per E-Mail.</li>
            <li>Die ZIP-Datei hier auswählen. Sie wird im Browser entpackt, nur die Daten werden hochgeladen.</li>
          </ol>
          {own ? <GarminImport /> : <p className="muted">Den Import macht die Person selbst.</p>}
        </div>
        <p className="note">Übernommen werden u. a. Schlafphasen und Sleep Score, Body Battery, Stress, HRV, Ruhepuls, SpO2, Atmung, Training Readiness, VO2max, Gewicht und alle Workouts. Alles Weitere bleibt als Rohdaten gespeichert.</p>
      </section>
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
