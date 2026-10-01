import Link from "next/link";
import Nav from "@/components/Nav";
import Logo from "@/components/Logo";
import SubjectPicker from "@/components/SubjectPicker";
import { viewerAndSubject } from "@/lib/subject";
import { logout, leaveDemo } from "../actions-auth";
import { switchSubject } from "../actions-subject";

export const dynamic = "force-dynamic";

const ROLE = { admin: "Admin", coach: "Coach", athlete: "Sportler" };

export default async function AppLayout({ children }) {
  const { viewer, subject, athletes } = await viewerAndSubject();
  const initials = viewer.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <div className="bar-top">
            <Link href="/heute" className="logo"><Logo /><b>Formstand</b></Link>
            <div className="who">
              {athletes.length > 0 && <SubjectPicker athletes={athletes} current={subject.id} viewerId={viewer.id} action={switchSubject} />}
              <Link href="/konto" className="logo" style={{ gap: 8 }} title="Mein Konto"><span className="ava">{initials}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{viewer.name}</span></Link>
              <span className="role">{ROLE[viewer.role]}</span>
              <form action={logout}><button className="btn ghost sm" type="submit">Abmelden</button></form>
            </div>
          </div>
          <Nav admin={viewer.role === "admin"} />
        </div>
      </header>
      <main className="wrap">
        {viewer.demo && <div className="notice good demo-bar"><span><b>Demo-Modus.</b> Alles sind Beispieldaten. Klick dich frei durch, ändern lässt sich hier nichts.</span><form action={leaveDemo}><button className="btn sm" type="submit">Eigenes Konto anlegen</button></form></div>}
        {viewer.must_change && <div className="notice warn">Du nutzt noch das Startpasswort. <Link href="/konto">Jetzt ändern</Link></div>}
        {subject.id !== viewer.id && <div className="notice warn">Du siehst die Daten von <b>{subject.name}</b>.</div>}
        {children}
      </main>
    </>
  );
}
