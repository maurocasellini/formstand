"use client";
import { useActionState, useContext, useEffect, useRef, useState } from "react";
import { ReadOnlyContext } from "./ReadOnly";
import Dictate from "./Dictate";

// Rückmeldung an den Coach: frei schreiben, Gültigkeit wählen, optional Plan anpassen lassen
export default function CoachReply({ action, ctx = "brief", period = null, planDefault = true, placeholder }) {
  const ro = useContext(ReadOnlyContext);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null), ta = useRef(null);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); setOpen(false); } }, [state]);
  if (ro) return null;
  return (
    <div className="creply">
      {!open ? <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>💬 Rückmeldung an den Coach</button> : (
        <form ref={ref} action={formAction} className="stack">
          <input type="hidden" name="ctx" value={ctx} />
          {period && <input type="hidden" name="period" value={period} />}
          <textarea ref={ta} name="text" rows={3} maxLength={600} required autoFocus placeholder={placeholder || "z. B. Am Wochenende kann ich nicht trainieren, dafür Montag und Dienstag je 2×. Knie links zwickt seit gestern."} />
          <div className="btnrow">
            <Dictate target={ta} />
            <label className="f" style={{ minWidth: 0 }}>Gilt<select name="scope" defaultValue="week"><option value="week">diese Woche</option><option value="always">dauerhaft</option></select></label>
            <label className="chk-l"><input type="checkbox" name="plan" defaultChecked={planDefault} /> Plan danach anpassen</label>
          </div>
          <div className="btnrow">
            <button className="btn" type="submit" disabled={pending}>{pending ? "Coach passt an… (ca. 30 s)" : "Senden"}</button>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>Abbrechen</button>
          </div>
        </form>
      )}
      {state?.error && <span className="notice crit">{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </div>
  );
}
