import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { changePassword, updateAccount } from "../../actions-auth";
import ActionForm from "@/components/ActionForm";
import PushToggle from "@/components/PushToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { vapid } from "@/lib/push";
import { savePushSub, deletePushSub, testPush, updateProfile } from "../../actions-data";
import { SPORTS } from "@/lib/catalog";
import { CYCLE_MODES } from "@/lib/cycle";

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
          <label className="f">Jahrgang<input type="number" name="birth_year" min="1930" max="2020" defaultValue={me.birth_year ?? ""} /></label>
          <label className="f">Geschlecht<select name="sex" defaultValue={me.sex || ""}><option value="">keine Angabe</option><option value="w">Frau</option><option value="m">Mann</option></select></label>
        </ActionForm>
        <ul className="note" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
          <li><b>Sportart</b> bestimmt, welche Einheiten der Plan vorschlägt (Rad, Laufen, Triathlon, Kraft/HYROX …), solange kein Wettkampf eingetragen ist.</li>
          <li><b>Gewicht, Körperfett und Grösse</b> trägst du unter <Link href="/bilder#messwerte">Körper</Link> ein – Formstand rechnet automatisch mit dem neusten Messwert (Waage über intervals.icu, InBody, eigene Einträge).</li>
          <li><b>Jahrgang</b> fliesst in die Einordnung ein (z. B. Erholungsbedarf) und wird der KI als Alter mitgegeben.</li>
        </ul>
      </section>
      )}
      {!me.demo && me.sex === "w" && (
        <section className="panel" id="zyklus">
          <h2>Zyklus-Tracking</h2>
          <p className="muted">Optional. Formstand zeigt dir Zyklustag und Phase, passt Hinweise zu Training, Ernährung und Erholung an und lernt, wie <i>deine</i> HRV und dein Ruhepuls je Phase reagieren – damit eine tiefere HRV vor der Periode nicht als Erholungsproblem gilt.</p>
          <ActionForm action={updateProfile} className="stack" reset={false}>
            <input type="hidden" name="cycle_form" value="1" />
            <label className="chk-l"><input type="checkbox" name="cycle_on" defaultChecked={Boolean(me.cycle_on)} /> Zyklus-Tracking einschalten</label>
            <div className="form">
              <label className="f">Situation<select name="cycle_mode" defaultValue={me.cycle_mode || "natural"}>{Object.entries(CYCLE_MODES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <label className="f">Übliche Zykluslänge (Tage)<input type="number" name="cycle_len" min="20" max="45" defaultValue={me.cycle_len || 28} /></label>
              <label className="f">Periode dauert (Tage)<input type="number" name="period_len" min="2" max="10" defaultValue={me.period_len || 5} /></label>
            </div>
            <label className="chk-l"><input type="checkbox" name="cycle_ai" defaultChecked={me.cycle_ai !== false} /> In KI-Empfehlungen berücksichtigen</label>
            <label className="chk-l"><input type="checkbox" name="cycle_share" defaultChecked={Boolean(me.cycle_share)} /> Für Coach/Admin sichtbar</label>
          </ActionForm>
          <ul className="note" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
            <li><b>Privat:</b> Zyklusdaten siehst nur du – ausser du gibst sie oben frei. Einträge kann nur die Person selbst machen.</li>
            <li><b>Eintragen:</b> auf der Übersicht «Periode hat begonnen» antippen; frühere Starts unter <Link href="/tagebuch#zyklus">Tagebuch → Zyklus</Link>. Nach 2–3 Zyklen rechnet Formstand mit deiner echten Zykluslänge.</li>
            <li><b>Hormonelle Verhütung:</b> Ohne natürlichen Zyklus gibt es keine Phasen-Prognose; Periode und Symptome kannst du trotzdem festhalten.</li>
            <li>Hinweise sind allgemeine Erfahrungswerte, keine medizinische Beratung und keine Verhütungsmethode.</li>
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
