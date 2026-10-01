import { requireUser } from "@/lib/auth";
import { changePassword, updateAccount } from "../../actions-auth";
import ActionForm from "@/components/ActionForm";
import PushToggle from "@/components/PushToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { vapid } from "@/lib/push";
import { savePushSub, deletePushSub, testPush, updateProfile } from "../../actions-data";
import { SPORTS } from "@/lib/catalog";

export default async function Konto({ searchParams }) {
  const sp = await searchParams;
  const me = await requireUser();
  let pub = null, pushError = null;
  if (!me.demo) { try { pub = (await vapid()).publicKey; } catch (e) { console.error("vapid", e); pushError = e.message; } }
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Mein Konto</h1><p>Benutzername: <b>{me.username}</b></p></div></div>
      {(me.must_change || sp?.neu) && <div className="notice warn">Du nutzt noch das Startpasswort. Bitte jetzt ein eigenes Passwort setzen.</div>}
      <section className="grid2e">
        <div className="panel">
          <h2>Passwort ändern</h2>
          <ActionForm action={changePassword} className="stack" submit="Passwort ändern">
            <label className="f">Aktuelles Passwort<input type="password" name="current" required autoComplete="current-password" /></label>
            <label className="f">Neues Passwort (mind. 8 Zeichen)<input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
            <label className="f">Neues Passwort wiederholen<input type="password" name="password2" required minLength={8} autoComplete="new-password" /></label>
          </ActionForm>
        </div>
        <div className="panel">
          <h2>Angaben</h2>
          <ActionForm action={updateAccount} className="stack" reset={false}>
            <label className="f">Name<input type="text" name="name" defaultValue={me.name} required /></label>
            <label className="f">E-Mail<input type="email" name="email" defaultValue={me.email || ""} /></label>
          </ActionForm>
        </div>
      </section>
      {!me.demo && (
      <section className="panel">
        <h2>Trainingsprofil</h2>
        <ActionForm action={updateProfile} reset={false}>
          <label className="f">Sportart<select name="sport" defaultValue={me.sport || ""}><option value="">–</option>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="f">Gewicht kg<input type="number" name="weight_kg" step="0.1" min="30" max="200" defaultValue={me.weight_kg ?? ""} /></label>
          <label className="f">Jahrgang<input type="number" name="birth_year" min="1930" max="2020" defaultValue={me.birth_year ?? ""} /></label>
        </ActionForm>
        <ul className="note" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
          <li><b>Sportart</b> bestimmt, welche Einheiten der Plan vorschlägt (Rad, Laufen, Triathlon, Kraft/HYROX …), solange kein Wettkampf eingetragen ist.</li>
          <li><b>Gewicht</b> braucht Formstand für Watt pro kg, Kalorien und Kohlenhydrate pro kg. Gerechnet wird automatisch mit dem neusten Messwert der letzten 14 Tage (Waage über intervals.icu, InBody, eigene Einträge) – dieses Feld gilt nur, wenn keiner vorliegt.</li>
          <li><b>Jahrgang</b> fliesst in die Einordnung ein (z. B. Erholungsbedarf) und wird der KI als Alter mitgegeben.</li>
        </ul>
      </section>
      )}
      {!me.demo && (
        <section className="panel">
          <h2>Morgen-Erinnerung</h2>
          <p className="muted">Jeden Morgen um ca. 07:00 eine Nachricht mit deiner Bereitschaft und dem Check-in (4 Fragen, 5 Sekunden). Pro Gerät einschalten, z. B. auf dem Handy.</p>
          {pub ? <PushToggle publicKey={pub} save={savePushSub} remove={deletePushSub} test={testPush} /> : <p className="notice warn">Erinnerungen sind gerade nicht verfügbar ({pushError}).</p>}
        </section>
      )}
      <section className="panel">
        <div className="panel-head"><h2>Darstellung</h2><ThemeToggle withLabel /></div>
        <p className="muted">Hell, dunkel oder wie dein Gerät eingestellt ist. Tippen wechselt; gilt pro Gerät. Oben in der Leiste geht es auch.</p>
      </section>
    </>
  );
}
