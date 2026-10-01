import { redirect } from "next/navigation";
import { hasDb, one } from "@/lib/db";
import { setupAdmin } from "../actions-auth";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Setup() {
  if (!hasDb) {
    return (
      <main className="auth"><div className="panel">
        <div className="logo"><Logo /><b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Formstand</b></div>
        <h1 style={{ fontSize: 24 }}>Datenbank verbinden</h1>
        <p>Die App läuft, aber es ist noch keine Datenbank angeschlossen.</p>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>In Vercel das Projekt <b>formstand</b> öffnen.</li>
          <li>Reiter <b>Storage</b> → <b>Create Database</b> → <b>Neon (Postgres)</b> → Free-Plan.</li>
          <li>Mit dem Projekt verbinden und neu deployen. Die Tabellen legt die App selbst an.</li>
        </ol>
      </div></main>
    );
  }
  const c = await one("select count(*)::int as n from users");
  if (c.n > 0) redirect("/login");
  return (
    <main className="auth"><div className="panel">
      <div className="logo"><Logo /><b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Formstand</b></div>
      <h1 style={{ fontSize: 24 }}>Admin-Konto anlegen</h1>
      <p className="muted">Das erste Konto ist der Admin. Danach legst du weitere Sportler und Coaches an.</p>
      <AuthForm action={setupAdmin} submit="Konto anlegen" fields={[
        { name: "name", label: "Name", auto: "name" },
        { name: "email", label: "E-Mail", type: "email", auto: "email" },
        { name: "password", label: "Passwort (mind. 10 Zeichen)", type: "password", auto: "new-password", min: 10 },
      ]} />
    </div></main>
  );
}
