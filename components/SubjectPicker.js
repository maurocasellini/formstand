"use client";
export default function SubjectPicker({ athletes, current, viewerId, action }) {
  return (
    <form action={action}>
      <select name="subject" defaultValue={current} aria-label="Sportler anzeigen" onChange={(e) => e.target.form.requestSubmit()} style={{ height: 34, fontWeight: 600 }}>
        <option value={viewerId}>Meine Daten</option>
        {athletes.filter((a) => a.id !== viewerId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.sport ? ` · ${a.sport}` : ""}</option>)}
      </select>
    </form>
  );
}
