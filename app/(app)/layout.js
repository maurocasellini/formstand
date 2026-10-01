import Link from "next/link";
import Nav from "@/components/Nav";
import Logo from "@/components/Logo";
import SubjectPicker from "@/components/SubjectPicker";
import { viewerAndSubject } from "@/lib/subject";
import { logout } from "../actions-auth";
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
              <span className="ava" title={viewer.email}>{initials}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{viewer.name}</span>
              <span className="role">{ROLE[viewer.role]}</span>
              <form action={logout}><button className="btn ghost sm" type="submit">Abmelden</button></form>
            </div>
          </div>
          <Nav admin={viewer.role === "admin"} />
        </div>
      </header>
      <main className="wrap">
        {subject.id !== viewer.id && <div className="notice warn">Du siehst die Daten von <b>{subject.name}</b>.</div>}
        {children}
      </main>
    </>
  );
}
