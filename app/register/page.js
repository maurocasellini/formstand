import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/repo";
import { register } from "../actions-auth";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Register() {
  if (await currentUser()) redirect("/heute");
  const s = await getSettings();
  return (
    <main className="auth">
      <div className="panel">
        <div className="logo"><Logo /><b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Formstand</b></div>
        <h1 style={{ fontSize: 24 }}>Konto anlegen</h1>
        {s.registrationOpen ? (
          <>
            <p className="muted">Danach verbindest du deine eigenen Apps: Garmin (über intervals.icu), Strava, WHOOP.</p>
            <AuthForm action={register} submit="Konto anlegen" fields={[
              { name: "username", label: "Benutzername", auto: "username" },
              { name: "name", label: "Vor- und Nachname", auto: "name" },
              { name: "email", label: "E-Mail (optional)", type: "email", auto: "email", required: false },
              { name: "password", label: "Passwort (mind. 8 Zeichen)", type: "password", auto: "new-password", min: 8 },
            ]} />
          </>
        ) : <div className="notice warn">Die Registrierung ist geschlossen. Konten legt der Admin an.</div>}
        <p className="note"><Link href="/login">Zurück zur Anmeldung</Link></p>
      </div>
    </main>
  );
}
