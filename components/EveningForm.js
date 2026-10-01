"use client";
import { useActionState, useContext, useEffect, useState } from "react";
import DateField from "./DateField";
import { ReadOnlyContext } from "./ReadOnly";

// Ein Abend: Datum wählen (auch rückwirkend), Alkohol in Gläsern, weitere Faktoren antippen.
// Beim Datumswechsel erscheint, was für diesen Abend schon gespeichert ist – Speichern ersetzt diesen Abend.
export default function EveningForm({ entries = {}, today, action, factors }) {
  const ro = useContext(ReadOnlyContext);
  const [day, setDay] = useState(today);
  const cur = entries[day] || { alc: 0, f: [] };
  const [alc, setAlc] = useState(cur.alc);
  const [sel, setSel] = useState(new Set(cur.f));
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => { const c = entries[day] || { alc: 0, f: [] }; setAlc(c.alc); setSel(new Set(c.f)); }, [day, entries]);
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const has = Boolean(entries[day]);

  return (
    <form action={formAction} className="stack eve">
      <fieldset disabled={ro} className="ro-fs stack">
        <div className="form">
          <label className="f">Datum<DateField name="day" value={day} onChange={(v) => v && setDay(v)} max={today} required /></label>
          <div className="f"><span className="lbl">Alkohol (Gläser)</span>
            <div className="step">
              <button type="button" onClick={() => setAlc((a) => Math.max(0, a - 1))} aria-label="Ein Glas weniger">−</button>
              <input type="number" name="alc" value={alc} min="0" max="20" onChange={(e) => setAlc(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
              <button type="button" onClick={() => setAlc((a) => Math.min(20, a + 1))} aria-label="Ein Glas mehr">+</button>
            </div>
          </div>
        </div>
        <div className="f"><span className="lbl">Weitere Einflussfaktoren</span>
          <div className="chips">{factors.map(([k, n]) => (
            <label key={k}><input type="checkbox" name="f" value={k} checked={sel.has(k)} onChange={() => toggle(k)} /><span>{n}</span></label>
          ))}</div>
        </div>
        <div className="btnrow">
          <button className="btn" type="submit" disabled={pending || ro}>{pending ? "Speichert…" : has ? "Aktualisieren" : "Speichern"}</button>
          {has && <span className="note">Für diesen Tag ist schon etwas gespeichert – Speichern ersetzt es.</span>}
        </div>
      </fieldset>
      {state?.error && <span className="notice crit">{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </form>
  );
}
