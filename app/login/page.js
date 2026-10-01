import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStore } from "@/lib/store";
import { currentUser } from "@/lib/auth";
import { getSettings, listUsers } from "@/lib/repo";
import { login, startDemo } from "../actions-auth";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (!hasStore) return <main className="auth"><div className="panel"><h1 style={{ fontSize: 24 }}>Speicher fehlt</h1><p>Der Datenspeicher ist nicht verbunden.</p></div></main>;
  if (await currentUser()) redirect("/heute");
  await listUsers(); // legt beim ersten Start die Startkonten an
  const s = await getSettings();
  return (
    <main className="auth">
      <div className="panel">
        <div className="logo"><Logo /><b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Formstand</b></div>
        <h1 style={{ fontSize: 24 }}>Anmelden</h1>
        <AuthForm action={login} submit="Anmelden" fields={[
          { name: "login", label: "Benutzername oder E-Mail", auto: "username" },
          { name: "password", label: "Passwort", type: "password", auto: "current-password" },
        ]} />
        <div className="demo-cta">
          <div><b>Erst mal reinschauen?</b><p className="note">Demo mit zwei Jahren Beispieldaten: Garmin, WHOOP, Strava, InBody, Tests und KI-Empfehlung.</p></div>
          <form action={startDemo}><button className="btn ghost" type="submit">Demo ansehen</button></form>
        </div>
        {s.registrationOpen ? <p className="note">Noch kein Konto? <Link href="/register">Jetzt registrieren</Link></p> : <p className="note">Konten legt der Admin an.</p>}
      </div>
    </main>
  );
}
