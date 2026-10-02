"use client";
import { useActionState } from "react";

export default function AuthForm({ action, fields, submit }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack">
      {fields.map((f) => (
        <label key={f.name} className="f">{f.label}
          {f.options ? <select name={f.name} defaultValue="">{f.options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select> :
          <input name={f.name} type={f.type || "text"} required={f.required !== false} autoComplete={f.auto} minLength={f.min} autoCapitalize="none" spellCheck={false} />}
          {f.hint && <small className="note">{f.hint}</small>}
        </label>
      ))}
      {state?.error && <div className="notice crit">{state.error}</div>}
      {state?.ok && <div className="notice good">{state.ok}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Einen Moment…" : submit}</button>
    </form>
  );
}
