"use client";
import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { ReadOnlyContext } from "./ReadOnly";

function Btn({ label }) {
  const { pending } = useFormStatus();
  return <button className="btn danger sm" type="submit" disabled={pending}>{pending ? "Löscht…" : label}</button>;
}

// Löschen mit Rückfrage – direkt sichtbar, ohne Umweg über „Datei bearbeiten“
export default function ConfirmDelete({ action, name = "id", value, label = "Löschen", ask = "Wirklich löschen? Das lässt sich nicht rückgängig machen." }) {
  const ro = useContext(ReadOnlyContext);
  if (ro) return null;
  return (
    <form action={action} className="cdel" onSubmit={(e) => { if (!window.confirm(ask)) e.preventDefault(); }}>
      <input type="hidden" name={name} value={value} />
      <Btn label={label} />
    </form>
  );
}
