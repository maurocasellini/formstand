import { requireAdmin } from "@/lib/auth";
import { q } from "@/lib/db";
import { SPORTS } from "@/lib/catalog";
import { createUser, setRole, resetPassword, deleteUser, assignCoach } from "../../actions-admin";
import ActionForm from "@/components/ActionForm";

const ROLE = { admin: "Admin", coach: "Coach", athlete: "Sportler" };
const when = (d) => (d ? new Date(d).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zurich" }) : "–");

export default async function Admin() {
  const me = await requireAdmin();
  const users = await q(`select u.id, u.name, u.email, u.role, u.sport, u.created_at,
      (select count(*) from activities a where a.user_id=u.id)::int as acts,
      (select count(*) from manual_entries m where m.user_id=u.id)::int as manual,
      (select count(*) from media x where x.user_id=u.id)::int as media,
      (select string_agg(provider, ', ') from connections c where c.user_id=u.id) as conns
    from users u order by u.created_at`);
  const pairs = await q(`select c.coach_id, c.athlete_id, a.name as coach, b.name as athlete from coach_athletes c join users a on a.id=c.coach_id join users b on b.id=c.athlete_id order by a.name, b.name`);
  const runs = await q(`select r.started_at, r.provider, r.ok, r.items, r.message, u.name from sync_runs r left join users u on u.id=r.user_id order by r.started_at desc limit 15`);
  const env = [
    ["Datenbank (Neon)", Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)],
    ["Dateispeicher (Blob)", Boolean(process.env.BLOB_READ_WRITE_TOKEN)],
    ["Token-Verschlüsselung", Boolean(process.env.ENCRYPTION_KEY)],
    ["Täglicher Abgleich (Cron)", Boolean(process.env.CRON_SECRET)],
    ["Strava-App", Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)],
    ["Strava-Webhook", Boolean(process.env.STRAVA_VERIFY_TOKEN)],
    ["WHOOP-App", Boolean(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET)],
    ["Garmin Health API", Boolean(process.env.GARMIN_CONSUMER_KEY)],
  ];
  const coaches = users.filter((u) => u.role === "coach" || u.role === "admin");
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Admin</h1><p>Konten, Rollen, Coach-Zuordnung und Systemstatus.</p></div></div>
      <section className="grid2">
        <div className="panel">
          <h2>Konto anlegen</h2>
          <ActionForm action={createUser} className="stack" submit="Konto anlegen">
            <label className="f">Name<input type="text" name="name" required /></label>
            <label className="f">E-Mail<input type="email" name="email" required /></label>
            <label className="f">Startpasswort (mind. 10 Zeichen)<input type="text" name="password" minLength={10} required /></label>
            <div className="form">
              <label className="f">Rolle<select name="role" defaultValue="athlete"><option value="athlete">Sportler</option><option value="coach">Coach</option><option value="admin">Admin</option></select></label>
              <label className="f">Sportart<select name="sport"><option value="">–</option>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
          </ActionForm>
        </div>
        <div className="panel">
          <h2>System</h2>
          <table><tbody>{env.map(([n, ok]) => <tr key={n}><td>{n}</td><td className="r"><span className={`tag ${ok ? "on" : "wait"}`}>{ok ? "aktiv" : "fehlt"}</span></td></tr>)}</tbody></table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Konten</h2><span className="note">{users.length} Personen</span></div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Quellen</th><th className="r">Workouts</th><th className="r">Eingaben</th><th className="r">Dateien</th><th>Passwort</th><th></th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.sport ? <div className="note">{u.sport}</div> : null}</td>
              <td>{u.email}</td>
              <td>{u.id === me.id ? <span className="tag next">{ROLE[u.role]} (du)</span> : (
                <form action={setRole} className="btnrow"><input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} style={{ height: 32 }}><option value="athlete">Sportler</option><option value="coach">Coach</option><option value="admin">Admin</option></select>
                  <button className="btn ghost sm" type="submit">Setzen</button></form>)}</td>
              <td>{u.conns || "–"}</td>
              <td className="r num">{u.acts}</td><td className="r num">{u.manual}</td><td className="r num">{u.media}</td>
              <td><ActionForm action={resetPassword} submit="Neu setzen"><input type="hidden" name="id" value={u.id} /><input type="text" name="password" placeholder="neues Passwort" minLength={10} style={{ height: 32, width: 150 }} /></ActionForm></td>
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
            <li key={p.coach_id + p.athlete_id}><span className="tag next">Coach</span><span>{p.coach} → {p.athlete}</span>
              <form action={assignCoach}><input type="hidden" name="coach" value={p.coach_id} /><input type="hidden" name="athlete" value={p.athlete_id} /><input type="hidden" name="remove" value="1" /><button className="x" type="submit" aria-label="Entfernen">✕</button></form></li>
          )) : <li style={{ gridTemplateColumns: "1fr" }}><span className="muted">Noch keine Zuordnung.</span></li>}</ul>
        </div>
        <div className="panel">
          <h2>Letzte Abgleiche</h2>
          {runs.length ? <div className="tbl-wrap"><table><thead><tr><th>Zeit</th><th>Person</th><th>Quelle</th><th className="r">Datensätze</th><th>Status</th></tr></thead><tbody>
            {runs.map((r, i) => <tr key={i}><td className="num">{when(r.started_at)}</td><td>{r.name || "–"}</td><td>{r.provider}</td><td className="r num">{r.items}</td><td className="wrap"><span className={`tag ${r.ok ? "on" : "err"}`}>{r.ok ? "ok" : "Fehler"}</span> {r.ok ? "" : r.message}</td></tr>)}
          </tbody></table></div> : <div className="empty">Noch keine Abgleiche.</div>}
        </div>
      </section>
    </>
  );
}
