"use client";
import { useActionState } from "react";

export default function SyncButton({ action, label = "Jetzt abgleichen" }) {
  const [state, run, pending] = useActionState(async () => action(), null);
  return (
    <form action={run} className="btnrow">
      <button className="btn" type="submit" disabled={pending}>{pending ? "Gleicht ab…" : label}</button>
      {Array.isArray(state) && <span className="note">{state.length ? state.map((r) => `${r.provider}: ${r.ok ? `${r.items} Datensätze` : r.message}`).join(" · ") : "Keine Verbindung vorhanden."}</span>}
    </form>
  );
}
