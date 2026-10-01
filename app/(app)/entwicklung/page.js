import Dashboard from "@/components/Dashboard";

export default function Entwicklung() {
  return (
    <>
      <div className="head">
        <div style={{ display: "grid", gap: 4 }}>
          <h1>Entwicklung</h1>
          <p>Woche, Monat, Quartal, Jahr oder frei wählbar. Kraft, Ausdauer und Alltag getrennt, alle Werte mit Vergleich zur Vorperiode.</p>
        </div>
      </div>
      <Dashboard />
    </>
  );
}
