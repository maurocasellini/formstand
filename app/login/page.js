import { redirect } from "next/navigation";
import { hasDb } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { login } from "../actions-auth";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (!hasDb) redirect("/setup");
  if (await currentUser()) redirect("/heute");
  return (
    <main className="auth">
      <div className="panel">
        <div className="logo"><Logo /><b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Formstand</b></div>
        <h1 style={{ fontSize: 24 }}>Anmelden</h1>
        <AuthForm action={login} submit="Anmelden" fields={[
          { name: "email", label: "E-Mail", type: "email", auto: "email" },
          { name: "password", label: "Passwort", type: "password", auto: "current-password" },
        ]} />
        <p className="note">Kein Konto? Der Admin legt Konten unter „Admin“ an.</p>
      </div>
    </main>
  );
}
