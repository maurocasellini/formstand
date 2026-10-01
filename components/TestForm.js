"use client";
import { useActionState, useContext, useEffect, useRef, useState } from "react";
import DateField from "./DateField";
import { ReadOnlyContext } from "./ReadOnly";

const e1rm = (kg, r) => Math.round((kg * 36) / (37 - r));
const secs = (v) => { const p = String(v || "").replace(",", ".").split(":").map(Number); if (!p.length || p.some((x) => !Number.isFinite(x))) return null; const s = p.reduce((a, x) => a * 60 + x, 0); return s > 0 ? s : null; };
const mss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Test eintragen: Bereich → Test → passende Felder (Kraft: Gewicht × 1–5 Wdh., Lauf: Zeit m:ss, Fitness: Wdh. in Dauer)
export default function TestForm({ action, types, groups, durations, today, start = "kraft" }) {
  const ro = useContext(ReadOnlyContext);
  const [group, setGroup] = useState(start);
  const keys = Object.keys(types).filter((k) => types[k].group === group);
  const [key, setKey] = useState(keys[0]);
  const [kg, setKg] = useState(""); const [reps, setReps] = useState(3); const [time, setTime] = useState("");
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (!types[key] || types[key].group !== group) setKey(keys[0]); }, [group]); // eslint-disable-line
  useEffect(() => { if (state?.ok) { setKg(""); setTime(""); ref.current?.querySelectorAll("input[name=value],input[name=note]").forEach((i) => (i.value = "")); } }, [state]);
  const t = types[key]?.group === group ? types[key] : types[keys[0]];
  const s = secs(time);
  const hint = t.fmt === "lift" && Number(kg) > 0 ? (reps > 1 ? `≈ ${e1rm(Number(kg), reps)} kg geschätztes 1RM` : "1RM") : t.fmt === "time" && s && t.dist ? `${mss((s / t.dist) * t.per)} pro ${t.per === 500 ? "500 m" : "km"}` : null;

  return (
    <form ref={ref} action={formAction} className="stack tform">
      <div className="seg" role="tablist" aria-label="Testbereich">
        {Object.entries(groups).map(([g, [n]]) => <button key={g} type="button" role="tab" aria-selected={g === group} className={g === group ? "on" : ""} onClick={() => setGroup(g)}>{n}</button>)}
      </div>
      <p className="note">{groups[group][1]}</p>
      <fieldset disabled={ro} className="ro-fs form">
        <input type="hidden" name="kind" value="test" />
        <label className="f">Test<select name="test" value={types[key]?.group === group ? key : keys[0]} onChange={(e) => setKey(e.target.value)}>{keys.map((k) => <option key={k} value={k}>{types[k].name}</option>)}</select></label>
        <label className="f">Datum<DateField name="day" defaultValue={today} max={today} /></label>
        {t.fmt === "lift" ? (<>
          <label className="f">Gewicht kg<input type="number" name="value" step="0.5" min="5" max="450" value={kg} onChange={(e) => setKg(e.target.value)} required /></label>
          <div className="f"><span className="lbl">Wiederholungen</span>
            <div className="seg sm">{[1, 2, 3, 4, 5].map((r) => <label key={r} className={r === reps ? "on" : ""}><input type="radio" name="reps" value={r} checked={r === reps} onChange={() => setReps(r)} />{r}</label>)}</div></div>
        </>) : t.fmt === "time" || t.fmt === "pace" ? (
          <label className="f">{t.label}<input type="text" name="time" inputMode="numeric" placeholder={t.fmt === "pace" ? "z. B. 4:10" : t.dist >= 5000 ? "z. B. 22:30" : "z. B. 3:35"} pattern="[0-9:.,]+" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
        ) : (<>
          <label className="f">{t.label}{t.unit && !t.dur ? ` (${t.unit})` : ""}<input type="number" name="value" min="1" max="5000" step={key === "vo2" ? "0.1" : "1"} required /></label>
          {t.dur && <label className="f">Dauer<select key={key} name="dur" defaultValue={key === "burpees" ? 5 : 3}>{durations.map((d) => <option key={d} value={d}>{d} min</option>)}</select></label>}
        </>)}
        <label className="f">Notiz<input type="text" name="note" maxLength={80} placeholder={t.fmt === "pace" ? "z. B. Ø Puls 172" : t.fmt === "lift" ? "z. B. Gürtel, RPE 9" : "optional"} /></label>
        <button className="btn" type="submit" disabled={pending || ro}>{pending ? "Speichert…" : "Eintragen"}</button>
      </fieldset>
      {hint && <p className="note"><b>{hint}</b></p>}
      <p className="note">{t.desc}</p>
      {state?.error && <span className="notice crit">{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </form>
  );
}
