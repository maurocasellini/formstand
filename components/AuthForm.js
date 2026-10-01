"use client";
import { useActionState } from "react";

export default function AuthForm({ action, fields, submit }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="stack">
      {fields.map((f) => (
        <label key={f.name} className="f">{f.label}
          <input name={f.name} type={f.type || "text"} required autoComplete={f.auto} minLength={f.min} />
        </label>
      ))}
      {state?.error && <div className="notice crit">{state.error}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Einen Moment…" : submit}</button>
    </form>
  );
}
