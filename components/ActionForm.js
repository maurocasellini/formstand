"use client";
import { useActionState, useRef, useEffect, useContext } from "react";
import { ReadOnlyContext } from "./ReadOnly";

// Formular mit Server-Action, Statusmeldung und Zurücksetzen nach Erfolg.
export default function ActionForm({ action, children, className = "form", submit = "Speichern", busy = "Speichert…", reset = true, encType }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  const ro = useContext(ReadOnlyContext);
  useEffect(() => { if (state?.ok && reset) ref.current?.reset(); }, [state, reset]);
  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      <fieldset disabled={ro} className="ro-fs">
      {children}
      <button className="btn" type="submit" disabled={pending || ro} title={ro ? "In der Demo nur zum Ansehen" : undefined}>{pending ? busy : submit}</button>
      </fieldset>
      {state?.error && <span className="notice crit" style={{ flexBasis: "100%" }}>{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </form>
  );
}
