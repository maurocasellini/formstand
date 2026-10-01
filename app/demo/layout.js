import Link from "next/link";
import Nav from "@/components/Nav";
import BackLink from "@/components/BackLink";
import Logo from "@/components/Logo";
import ReadOnly from "@/components/ReadOnly";

// Öffentliche Demo: eigenständig, ohne Anmeldung, nur Beispieldaten aus dem Speicher.
export const dynamic = "force-dynamic";
export const metadata = { title: "Formstand – Demo", description: "Formstand mit zwei Jahren Beispieldaten ausprobieren." };

export default function DemoLayout({ children }) {
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <div className="bar-top">
            <Link href="/demo" className="logo"><Logo /><b>Formstand</b><span className="tag next" style={{ marginLeft: 6 }}>Demo</span></Link>
            <div className="who">
              <Link className="btn ghost sm" href="/login">Anmelden</Link>
              <Link className="btn sm" href="/register">Eigenes Konto</Link>
            </div>
          </div>
          <Nav demo />
        </div>
      </header>
      <ReadOnly>
        <main className="wrap demo-ro">
          <div className="notice good demo-bar"><span><b>Demo.</b> Alex ist fiktiv, alle Werte sind Beispieldaten (Garmin, WHOOP, Strava, InBody). Klick dich frei durch; speichern lässt sich hier nichts.</span><Link className="btn sm" href="/register">Eigenes Konto anlegen</Link></div>
          <BackLink demo />
          {children}
        </main>
      </ReadOnly>
    </>
  );
}
