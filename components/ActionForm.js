"use client";
import { useActionState, useRef, useEffect } from "react";

// Formular mit Server-Action, Statusmeldung und Zurücksetzen nach Erfolg.
export default function ActionForm({ action, children, className = "form", submit = "Speichern", reset = true, encType }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (state?.ok && reset) ref.current?.reset(); }, [state, reset]);
  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      {children}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Speichert…" : submit}</button>
      {state?.error && <span className="notice crit" style={{ flexBasis: "100%" }}>{state.error}</span>}
      {state?.ok && <span className="note" style={{ color: "var(--good)", fontWeight: 600 }}>{state.ok}</span>}
    </form>
  );
}
