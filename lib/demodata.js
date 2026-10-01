// Die öffentliche Demo (/demo): ein fiktives Konto, dessen Daten bei Bedarf im Speicher entstehen.
// Nichts wird gespeichert, keine Anmeldung, kein gemeinsames Konto – pro Tag einmal erzeugt und zwischengespeichert.
import { generateDemo } from "./demogen";

export const DEMO_ID = "demo";
const iso = (d) => d.toISOString().slice(0, 10);
const plus = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const today = () => iso(new Date(Date.now() + 2 * 3600e3)); // wie metrics.todayIso (CH-Zeit grob)

export const DEMO_USER = { id: DEMO_ID, username: "demo", email: null, name: "Alex Demo", role: "athlete", sport: "Rad & Laufen", weight_kg: 76, birth_year: 1990, must_change: false, sver: 1, demo: true };

let cache = null;
export function demoData() {
  const t = today();
  if (cache?.day === t) return cache;
  const g = generateDemo({ seed: DEMO_ID, kg: 76, rich: true, today: t });
  cache = {
    day: t,
    activities: [...g.acts].sort((a, b) => (a.start_time < b.start_time ? -1 : 1)),
    daily: g.daily,
    manual: g.manual.map((m, i) => ({ id: `demo-${i}`, created_at: `${m.day}T07:00:00Z`, ...m })),
    feel: g.feel,
    connections: [{ provider: "garmin", status: "active" }, { provider: "whoop", status: "active" }, { provider: "strava", status: "active" }],
    goals: {
      focus: "performance", mainWeakness: "klettern", weaknesses: ["schwelle", "kraft_beine", "schwimmen"], daysPerWeek: 5, hoursPerWeek: 8, longDay: 6,
      note: "Am Berg verliere ich ab der Hälfte den Anschluss.", targetWeight: 74, targetBodyfat: null, rate: 0.5, swimsPerWeek: null, updated_at: `${t}T06:00:00Z`,
      events: [{ id: "demo-b", name: "Herbstlauf 10 km (Beispiel)", date: plus(t, 23), type: "lauf_10k", priority: "B", target: "unter 45 min" },
        { id: "demo-a", name: "Alpen-Radmarathon (Beispiel)", date: plus(t, 66), type: "rad_marathon", priority: "A", target: "unter 6 h" }],
    },
  };
  return cache;
}
