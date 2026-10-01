import { requireUser } from "@/lib/auth";
import { changePassword, updateAccount } from "../../actions-auth";
import ActionForm from "@/components/ActionForm";

export default async function Konto({ searchParams }) {
  const sp = await searchParams;
  const me = await requireUser();
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
          <p className="note">Sportart, Gewicht und Jahrgang findest du unter „Eingaben“.</p>
        </div>
      </section>
    </>
  );
}
