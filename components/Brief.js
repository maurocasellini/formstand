import ActionForm from "./ActionForm";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

// Wochenbrief: Fliesstext der KI zu allem – Gesamtbild, Training, Erholung, Körper & Ziele, Fokus der Woche
export default function Brief({ b, state, ai, ro, action }) {
  return (
    <div className="brief">
      {b ? (<>
        <h3 className="brief-t">{b.titel}</h3>
        {b.absaetze.map((p, i) => <p key={i}>{p}</p>)}
        {b.fokus?.length > 0 && <div className="brief-f"><span className="lbl">Fokus diese Woche</span><ol>{b.fokus.map((x) => <li key={x}>{x}</li>)}</ol></div>}
        {b.ausblick && <p className="brief-a"><b>Ausblick:</b> {b.ausblick}</p>}
        <p className="note">Geschrieben am {new Date(b.created_at).toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" })} · {b.week ? `Woche ab ${fmt(b.week)}` : ""} · erneuert sich jeden Montag automatisch · KI-Einschätzung aus deinen Daten, keine ärztliche Beratung.</p>
      </>) : state?.pending ? <div className="notice good">Dein Wochenbrief wird gerade geschrieben – in etwa 30 Sekunden die Seite neu laden.</div>
        : <p className="muted">{ai ? "Noch kein Wochenbrief. Er entsteht jeden Montag automatisch – oder jetzt auf Knopfdruck." : "Der Wochenbrief braucht die KI (Admin → Schnittstellen)."}</p>}
      {b && state?.pending && <p className="note">Der Brief für diese Woche wird gerade geschrieben – gleich neu laden.</p>}
      {state?.error && !state.pending && <p className="note" style={{ color: "var(--crit)" }}>Letzter Versuch fehlgeschlagen: {state.error}</p>}
      {ai && !ro && <ActionForm action={action} className="btnrow" submit={b ? "Jetzt neu schreiben" : "Wochenbrief schreiben"} busy="Schreibt… (ca. 30 s)" reset={false} />}
    </div>
  );
}
