"use client";
import { useActionState, useContext, useEffect, useRef, useState } from "react";
import { ReadOnlyContext } from "./ReadOnly";

// Einen Tag im Wochenplan anpassen: Vorschlag ist vorausgefüllt, man ändert nur, was anders ist.
const TYPES = [["quality", "Hart"], ["easy", "Locker"], ["long", "Lang & ruhig"], ["strength", "Kraft"]];
const SPORTS = [["bike", "Rad"], ["run", "Laufen"], ["swim", "Schwimmen"], ["strength", "Kraft"], ["hyrox", "HYROX/Hybrid"], ["other", "Anderes"]];
const MODES = [["session", "Anders trainieren", "Art, Dauer oder Inhalt ändern – z. B. mit Buddy"], ["swap", "Mit anderem Tag tauschen", "z. B. die harte Einheit auf morgen"], ["max", "Nur begrenzt Zeit", "Formstand kürzt die Einheit"], ["off", "Ruhetag / keine Zeit", "Der Rest der Woche wird neu verteilt"]];
const asType = (t) => (t === "quality" || t === "long" || t === "strength" ? t : "easy");

export default function DayEditor({ item, label, others, action, autoOpen }) {
  const ro = useContext(ReadOnlyContext);
  const dlg = useRef(null);
  const [state, formAction, pending] = useActionState(action, null);
  const [mode, setMode] = useState("session");
  useEffect(() => { if (autoOpen && !ro) dlg.current?.showModal(); }, [autoOpen, ro]);
  useEffect(() => { if (state?.ok) { const t = setTimeout(() => dlg.current?.close(), 700); return () => clearTimeout(t); } }, [state]);
  if (ro) return null;
  const rest = item.type === "rest" || !item.min;
  const sport = item.sport || (item.type === "strength" ? "strength" : "bike");

  return (
    <>
      <button type="button" className="adjb" onClick={() => { setMode("session"); dlg.current?.showModal(); }}>Anpassen</button>
      <dialog ref={dlg} className="dlg" onClick={(e) => { if (e.target === dlg.current) dlg.current.close(); }}>
        <form action={formAction} className="stack">
          <input type="hidden" name="date" value={item.day} />
          <div className="dlg-h">
            <div><b>{label}</b><p className="note">Vorschlag: {item.title}{item.min ? ` · ${item.min} min` : ""}{item.custom ? " (von dir angepasst)" : ""}</p></div>
            <button type="button" className="x" onClick={() => dlg.current?.close()} aria-label="Schliessen">✕</button>
          </div>
          <div className="modes">
            {MODES.filter(([k]) => k !== "swap" || others.length).map(([k, t, d]) => (
              <label key={k} className={`mode${mode === k ? " on" : ""}`}><input type="radio" name="mode" value={k} checked={mode === k} onChange={() => setMode(k)} /><b>{t}</b><span>{d}</span></label>
            ))}
            {item.custom && <label className={`mode${mode === "plan" ? " on" : ""}`}><input type="radio" name="mode" value="plan" checked={mode === "plan"} onChange={() => setMode("plan")} /><b>Vorschlag wiederherstellen</b><span>Deine Änderung verwerfen</span></label>}
          </div>

          {mode === "session" && (
            <div className="stack">
              <label className="f">Was machst du?<input type="text" name="title" maxLength={60} defaultValue={rest ? "" : item.title} placeholder="z. B. Ausfahrt mit Buddy" required /></label>
              <div className="form">
                <label className="f">Art<select name="type" defaultValue={rest ? "easy" : asType(item.type)}>{TYPES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className="f">Sport<select name="sport" defaultValue={sport}>{SPORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className="f">Dauer min<input type="number" name="dur" min="10" max="600" step="5" defaultValue={item.min || 60} /></label>
              </div>
              <label className="f">Notiz (optional)<input type="text" name="note" maxLength={160} placeholder="z. B. Gruppe fährt zügig, 2 Anstiege" /></label>
            </div>
          )}
          {mode === "swap" && (
            <label className="f">Tauschen mit<select name="with" defaultValue={others[0]?.day}>{others.map((o) => <option key={o.day} value={o.day}>{o.label} – {o.title}</option>)}</select></label>
          )}
          {mode === "max" && <label className="f">Minuten verfügbar<input type="number" name="min" min="10" max="600" step="5" defaultValue={Math.min(item.min || 60, 45)} required /></label>}
          {mode === "off" && <label className="f">Grund (optional)<input type="text" name="note" maxLength={120} placeholder="z. B. Geschäftsreise" /></label>}
          {(mode === "session" || mode === "max" || mode === "off") && <label className="chk-l"><input type="checkbox" name="repeat" value="1" /> jede Woche so (fester Termin)</label>}

          <div className="btnrow">
            <button className="btn" type="submit" disabled={pending}>{pending ? "Speichert…" : "Übernehmen"}</button>
            <button className="btn ghost" type="button" onClick={() => dlg.current?.close()}>Abbrechen</button>
          </div>
          {state?.error && <div className="notice crit">{state.error}</div>}
          {state?.ok && <p className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</p>}
        </form>
      </dialog>
    </>
  );
}
