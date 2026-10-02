"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Sportler wählen: zeigt immer die tatsächlich angezeigte Person (kontrolliert), wechselt erst nach dem Speichern
export default function SubjectPicker({ athletes, current, viewerId, action }) {
  const [val, setVal] = useState(current);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setVal(current); }, [current]);
  const change = (id) => {
    setVal(id);
    start(async () => {
      const fd = new FormData(); fd.set("subject", id);
      await action(fd);
      router.refresh();
    });
  };
  return (
    <select name="subject" value={val} disabled={pending} aria-label="Sportler anzeigen" aria-busy={pending} onChange={(e) => change(e.target.value)} style={{ height: 34, fontWeight: 600, opacity: pending ? 0.6 : 1 }}>
      <option value={viewerId}>Meine Daten</option>
      {athletes.filter((a) => a.id !== viewerId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.sport ? ` · ${a.sport}` : ""}</option>)}
    </select>
  );
}
