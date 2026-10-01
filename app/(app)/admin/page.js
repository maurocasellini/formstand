import { requireAdmin } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { appCreds } from "@/lib/apps";
import { aiConfig, MODELS, getUsage } from "@/lib/ai";
import { baseUrl } from "@/lib/baseurl";
import { SPORTS } from "@/lib/catalog";
import { createUser, setRole, resetPassword, deleteUser, assignCoach, saveApp, removeApp, setRegistration } from "../../actions-admin";
import ActionForm from "@/components/ActionForm";

const ROLE = { admin: "Admin", coach: "Coach", athlete: "Sportler" };
const when = (d) => (d ? new Date(d).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }) : "–");

const APPS = [
  { id: "strava", name: "Strava", url: "https://www.strava.com/settings/api", how: "Auf strava.com/settings/api eine App anlegen (braucht ein Strava-Abo). Bei „Authorization Callback Domain“ die Domain unten eintragen." },
  { id: "whoop", name: "WHOOP", url: "https://developer.whoop.com", how: "Auf developer.whoop.com eine App anlegen. Als Redirect-URL die Adresse unten eintragen, alle read-Scopes und offline aktivieren." },
];

export default async function Admin() {
  const me = await requireAdmin();
  // Das frühere gemeinsame Demo-Konto ist durch /demo ersetzt: einmalig aufräumen
  for (const u of (await repo.listUsers()).filter((x) => x.demo)) await repo.deleteUser(u.id);
  const [users, pairs, runs, settings, base] = await Promise.all([repo.listUsers(), repo.listPairs(), repo.listRuns(), repo.getSettings(), baseUrl()]);
  const stats = await Promise.all(users.map(async (u) => {
    const [conns, acts, man, media] = await Promise.all([repo.getConnections(u.id), repo.getActivities(u.id), repo.getManual(u.id), repo.getMedia(u.id)]);
    return { id: u.id, conns: conns.map((c) => c.provider).join(", "), acts: acts.length, manual: man.length, media: media.length };
  }));
  const st = Object.fromEntries(stats.map((s) => [s.id, s]));
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const creds = Object.fromEntries(await Promise.all(APPS.map(async (a) => [a.id, await appCreds(a.id)])));
  const ai = await aiConfig();
  const usage = await getUsage();
  const mon = new Date().toISOString().slice(0, 7), um = usage[mon] || { usd: 0, calls: 0, users: {}, kinds: {} };
  const usd = (v) => `$${(v || 0).toFixed((v || 0) < 1 ? 3 : 2)}`;
  const host = base.replace(/^https?:\/\//, "");
  const coaches = users.filter((u) => u.role === "coach" || u.role === "admin");
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Admin</h1><p>Konten, Rollen, Schnittstellen und Systemstatus. Alles hier, nichts in Vercel.</p></div></div>

      <section className="panel">
        <div className="panel-head"><h2>Schnittstellen freischalten</h2><span className="note">einmalig pro App, danach verbindet jede Person ihr eigenes Konto</span></div>
        <div className="grid2e">
          {APPS.map((a) => {
            const c = creds[a.id], ok = Boolean(c.clientId && c.clientSecret);
            return (
              <div key={a.id} className="card">
                <div className="t">{a.name}<span className={`tag ${ok ? "on" : "wait"}`}>{ok ? "freigeschaltet" : "offen"}</span></div>
                <p>{a.how}</p>
                <p className="note num">{a.id === "strava" ? `Callback-Domain: ${host}` : `Redirect-URL: ${base}/api/oauth/whoop`}</p>
                <ActionForm action={saveApp} className="stack" submit={ok ? "Aktualisieren" : "Freischalten"}>
                  <input type="hidden" name="provider" value={a.id} />
                  <label className="f">Client ID<input type="text" name="clientId" defaultValue={c.clientId} autoComplete="off" /></label>
                  <label className="f">Client Secret{ok ? " (gespeichert, nur zum Ändern ausfüllen)" : ""}<input type="password" name="clientSecret" autoComplete="off" /></label>
                </ActionForm>
                {ok && <form action={removeApp}><input type="hidden" name="provider" value={a.id} /><button className="btn danger sm" type="submit">Entfernen</button></form>}
                {a.id === "strava" && ok && c.verifyToken && <p className="note">Für sofortige Updates bei neuen Workouts: Strava-Webhook mit Callback <span className="num">{base}/api/webhooks/strava</span> und Verify-Token <span className="num">{c.verifyToken}</span> registrieren.</p>}
              </div>
            );
          })}
          <div className="card">
            <div className="t">Claude (KI)<span className={`tag ${ai.key ? "on" : "wait"}`}>{ai.key ? "freigeschaltet" : "offen"}</span></div>
            <p>Erklärt die Tagesentscheidung nach dem Check-in, liest InBody-Blätter aus und vergleicht Körperfotos. Schlüssel auf console.anthropic.com unter „API Keys“ erstellen.</p>
            <p className="note">Dafür werden die Daten der jeweiligen Person an die Claude-API geschickt (Fotos nur auf Knopfdruck).</p>
            {ai.key && (
              <div className="aicost">
                <div><b>{usd(um.usd)}</b><small>diesen Monat · {um.calls} Aufrufe{ai.monthlyCapUsd > 0 ? ` · Limit ${usd(ai.monthlyCapUsd)}` : ""}</small></div>
                {ai.monthlyCapUsd > 0 && <div className="bar"><i style={{ width: `${Math.min(100, (um.usd / ai.monthlyCapUsd) * 100)}%`, background: um.usd >= ai.monthlyCapUsd ? "var(--crit)" : "var(--accent)" }} /></div>}
                <small className="note">{Object.entries(um.kinds).map(([k, v]) => `${{ advice: "Erklärungen", inbody: "InBody", photo: "Fotovergleich" }[k] || k}: ${usd(v.usd)} (${v.calls}×)`).join(" · ") || "Noch keine Aufrufe."}</small>
                {Object.keys(um.users).length > 0 && <small className="note">Pro Person: {Object.entries(um.users).map(([id, v]) => `${names[id] || "System"} ${usd(v.usd)}`).join(" · ")}</small>}
              </div>
            )}
            <ActionForm action={saveApp} className="stack" submit={ai.key ? "Aktualisieren" : "Freischalten"}>
              <input type="hidden" name="provider" value="anthropic" />
              <label className="f">API-Schlüssel{ai.key ? " (gespeichert, nur zum Ändern ausfüllen)" : ""}<input type="password" name="apiKey" autoComplete="off" placeholder="sk-ant-…" /></label>
              <div className="form">
                <label className="f">Tageserklärung<select name="adviceModel" defaultValue={ai.adviceModel}>{Object.entries(MODELS).map(([id, m]) => <option key={id} value={id}>{m.name} · ${m.price[0]}/${m.price[1]} pro Mio.</option>)}</select></label>
                <label className="f">InBody & Fotos<select name="visionModel" defaultValue={ai.visionModel}>{Object.entries(MODELS).map(([id, m]) => <option key={id} value={id}>{m.name} · ${m.price[0]}/${m.price[1]} pro Mio.</option>)}</select></label>
                <label className="f">Monatslimit $ (0 = keines)<input type="number" name="monthlyCapUsd" min="0" max="500" step="any" defaultValue={ai.monthlyCapUsd} /></label>
              </div>
            </ActionForm>
            <p className="note">Empfohlen: Haiku für die Erklärung (formuliert nur, ca. $0.005 pro Tag und Person), Sonnet fürs Lesen von Blättern und Fotos (Genauigkeit). Ist das Limit erreicht, läuft Formstand ohne KI-Texte weiter.</p>
            {ai.key && <form action={removeApp}><input type="hidden" name="provider" value="anthropic" /><button className="btn danger sm" type="submit">Entfernen</button></form>}
          </div>
        </div>
        <p className="note">Garmin läuft ohne Freischaltung über intervals.icu (jede Person trägt ihren eigenen Schlüssel unter „Quellen“ ein) und über den Garmin-Datenexport.</p>
      </section>

      <section className="grid2">
        <div className="panel">
          <h2>Konto anlegen</h2>
          <ActionForm action={createUser} className="stack" submit="Konto anlegen">
            <div className="form">
              <label className="f">Benutzername<input type="text" name="username" required autoCapitalize="none" /></label>
              <label className="f">Name<input type="text" name="name" required /></label>
            </div>
            <label className="f">E-Mail (optional)<input type="email" name="email" /></label>
            <label className="f">Startpasswort (mind. 6 Zeichen, muss beim ersten Login geändert werden)<input type="text" name="password" minLength={6} required /></label>
            <div className="form">
              <label className="f">Rolle<select name="role" defaultValue="athlete"><option value="athlete">Sportler</option><option value="coach">Coach</option><option value="admin">Admin</option></select></label>
              <label className="f">Sportart<select name="sport"><option value="">–</option>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <h2>Registrierung</h2>
          <p className="muted">{settings.registrationOpen ? "Offen: Jede Person kann sich unter /register selbst ein Konto anlegen (als Sportler)." : "Geschlossen: Nur der Admin legt Konten an."}</p>
          <form action={setRegistration}><input type="hidden" name="open" value={settings.registrationOpen ? "0" : "1"} /><button className="btn ghost" type="submit">{settings.registrationOpen ? "Registrierung schliessen" : "Registrierung öffnen"}</button></form>
          <p className="note num">Link zum Teilen: {base}/register</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Konten</h2><span className="note">{users.length} Personen</span></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Name</th><th>Benutzername</th><th>Rolle</th><th>Quellen</th><th className="r">Workouts</th><th className="r">Eingaben</th><th className="r">Dateien</th><th>Passwort</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.sport ? <div className="note">{u.sport}</div> : null}</td>
              <td>{u.username}{u.email ? <div className="note">{u.email}</div> : null}{u.must_change ? <div><span className="tag wait">Startpasswort</span></div> : null}</td>
              <td>{u.id === me.id ? <span className="tag next">{ROLE[u.role]} (du)</span> : (
                <form action={setRole} className="btnrow"><input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} style={{ height: 32 }}><option value="athlete">Sportler</option><option value="coach">Coach</option><option value="admin">Admin</option></select>
                  <button className="btn ghost sm" type="submit">Setzen</button></form>)}</td>
              <td>{st[u.id].conns || "–"}</td>
              <td className="r num">{st[u.id].acts}</td><td className="r num">{st[u.id].manual}</td><td className="r num">{st[u.id].media}</td>
              <td><ActionForm action={resetPassword} submit="Neu setzen"><input type="hidden" name="id" value={u.id} /><input type="text" name="password" placeholder="neues Passwort" minLength={6} style={{ height: 32, width: 150 }} /></ActionForm></td>
              <td>{u.id !== me.id && <form action={deleteUser} className="btnrow"><input type="hidden" name="id" value={u.id} /><input type="text" name="confirm" placeholder="LÖSCHEN tippen" style={{ height: 32, width: 130 }} aria-label="Zum Bestätigen LÖSCHEN eintippen" /><button className="btn danger sm" type="submit">Löschen</button></form>}</td>
            </tr>))}</tbody>
        </table></div>
      </section>

      <section className="grid2e">
        <div className="panel">
          <h2>Coach-Zuordnung</h2>
          <p className="muted">Ein Coach sieht nur die Sportler, die ihm zugeordnet sind, und kann für sie Eingaben machen.</p>
          <form action={assignCoach} className="form">
            <label className="f">Coach<select name="coach">{coaches.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label className="f">Sportler<select name="athlete">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <button className="btn" type="submit">Zuordnen</button>
          </form>
          <ul className="list">{pairs.length ? pairs.map((p) => (
            <li key={p.coach_id + p.athlete_id}><span className="tag next">Coach</span><span>{names[p.coach_id]} → {names[p.athlete_id]}</span>
              <form action={assignCoach}><input type="hidden" name="coach" value={p.coach_id} /><input type="hidden" name="athlete" value={p.athlete_id} /><input type="hidden" name="remove" value="1" /><button className="x" type="submit" aria-label="Entfernen">✕</button></form></li>
          )) : <li style={{ gridTemplateColumns: "1fr" }}><span className="muted">Noch keine Zuordnung.</span></li>}</ul>
        </div>
        <div className="panel">
          <h2>Letzte Abgleiche</h2>
          {runs.length ? <div className="tbl-wrap"><table><thead><tr><th>Zeit</th><th>Person</th><th>Quelle</th><th className="r">Datensätze</th><th>Status</th></tr></thead><tbody>
            {runs.slice(0, 15).map((r, i) => <tr key={i}><td className="num">{when(r.started_at)}</td><td>{names[r.user_id] || "–"}</td><td>{r.provider}</td><td className="r num">{r.items}</td><td className="wrap"><span className={`tag ${r.ok ? "on" : "err"}`}>{r.ok ? "ok" : "Fehler"}</span> {r.ok ? "" : r.message}</td></tr>)}
          </tbody></table></div> : <div className="empty">Noch keine Abgleiche.</div>}
        </div>
      </section>
    </>
  );
}
