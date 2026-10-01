"use client";
import { useActionState, useContext, useEffect, useRef, useState } from "react";
import DateField from "./DateField";
import { ReadOnlyContext } from "./ReadOnly";

// Neues messbares Ziel: Was (Messgrösse) → Zielwert → bis wann. Startwert kommt aus den letzten Messungen.
export default function TargetForm({ action, metrics, current = {}, today, minDay }) {
  const ro = useContext(ReadOnlyContext);
  const [metric, setMetric] = useState("weight");
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  const m = metrics[metric] || {};
  const groups = [...new Set(Object.values(metrics).map((x) => x.group))];
  const cur = current[metric];
  const ph = m.time ? (metric === "t:norwegian" ? "z. B. 4:15" : "z. B. 21:30") : m.unit === "kg" ? "z. B. 78" : "Zielwert";
  return (
    <form ref={ref} action={formAction} className="stack">
      <fieldset disabled={ro} className="ro-fs form">
        <label className="f">Was willst du erreichen?<select name="metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
          {groups.map((g) => <optgroup key={g} label={g}>{Object.entries(metrics).filter(([, x]) => x.group === g).map(([k, x]) => <option key={k} value={k}>{x.name}</option>)}</optgroup>)}
        </select></label>
        {metric === "free" ? (
          <label className="f" style={{ flex: "2 1 260px" }}>Ziel<input type="text" name="label" maxLength={80} placeholder="z. B. HYROX unter 1:30 h finishen, Halbmarathon ohne Gehpause" required /></label>
        ) : (<>
          <label className="f">Zielwert{m.time ? " (m:ss)" : m.unit ? ` (${m.unit})` : ""}<input type={m.time ? "text" : "number"} name="target" step={m.step || 1} inputMode={m.time ? "numeric" : "decimal"} placeholder={ph} required /></label>
          <label className="f">Startwert<input type={m.time ? "text" : "number"} name="start" step={m.step || 1} placeholder={cur ? `aktuell ${cur}` : "aktueller Wert"} /></label>
        </>)}
        <label className="f">Bis wann?<DateField name="by" min={minDay} placeholder="Zieldatum wählen" required /></label>
        <label className="f" style={{ flex: "2 1 260px" }}>Warum / Notiz<input type="text" name="note" maxLength={200} placeholder="z. B. für den Sommerurlaub, fürs Rennen im Mai" /></label>
        <button className="btn" type="submit" disabled={pending || ro}>{pending ? "Speichert…" : "Ziel setzen"}</button>
      </fieldset>
      {metric !== "free" && <p className="note">{cur ? `Startwert leer lassen = aktueller Stand (${cur}).` : "Für diese Grösse gibt es noch keinen Messwert – bitte den Startwert eintragen."}{m.unit === "Wdh. in 5 min" ? " Gemessen als Wiederholungen in 5 Minuten." : ""}</p>}
      {state?.error && <span className="notice crit">{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </form>
  );
}
