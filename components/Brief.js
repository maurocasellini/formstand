import ActionForm from "./ActionForm";
import CoachReply from "./CoachReply";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

// Wochenbrief: Fliesstext der KI zu allem – Gesamtbild, Training, Erholung, Körper & Ziele, Fokus der Woche
export default function Brief({ b, state, ai, ro, action, reply, notes = [], delNote }) {
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
      {notes.length > 0 && (
        <div className="stack"><span className="lbl">Deine Hinweise an den Coach</span>
          <ul className="notes">{notes.map((n) => (
            <li key={n.id}><span>{n.data.text}<small>{n.data.scope === "always" ? "dauerhaft" : "diese Woche"} · {n.day.split("-").reverse().join(".")}</small></span>
              {!ro && delNote && <form action={delNote}><input type="hidden" name="id" value={n.id} /><button className="x" type="submit" aria-label="Hinweis löschen">✕</button></form>}</li>
          ))}</ul>
        </div>
      )}
      <div className="btnrow">
        {ai && !ro && reply && <CoachReply action={reply} ctx="brief" />}
        {ai && !ro && <ActionForm action={action} className="btnrow" submit={b ? "Wochenbrief aktualisieren" : "Wochenbrief schreiben"} busy="Schreibt… (ca. 30 s)" reset={false} />}
      </div>
    </div>
  );
}
