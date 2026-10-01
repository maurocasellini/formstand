// VO2max: Verlauf aus Uhr (intervals.icu / Garmin-Export) und Tests, Einordnung nach Alter und Geschlecht, Fitnessalter.
// Normen angelehnt an die Cooper-Institut-Tabellen (wie Garmin sie verwendet): Untergrenzen für
// [mässig, gut, ausgezeichnet, überragend] je Altersgruppe; darunter = schwach.
const NORMS = {
  m: { 25: [41.7, 45.4, 51.1, 55.4], 35: [40.5, 44.0, 48.3, 54.0], 45: [38.5, 42.4, 46.4, 52.5], 55: [35.6, 39.2, 43.4, 48.9], 65: [32.3, 35.5, 39.5, 45.7], 75: [29.4, 32.3, 36.7, 42.1] },
  w: { 25: [36.1, 39.5, 43.9, 49.6], 35: [34.4, 37.8, 42.4, 47.4], 45: [33.0, 36.3, 39.7, 45.3], 55: [30.1, 33.0, 36.7, 41.1], 65: [27.5, 30.0, 33.0, 37.8], 75: [25.9, 28.1, 30.9, 36.7] },
};
export const VO2_CLASSES = ["schwach", "mässig", "gut", "ausgezeichnet", "überragend"];
const AGES = [25, 35, 45, 55, 65, 75];
const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };

// Schwellen für ein beliebiges Alter (linear zwischen den Gruppenmitten)
function normsAt(age, sex) {
  const t = NORMS[sex === "w" ? "w" : "m"], a = Math.max(25, Math.min(75, age));
  const lo = AGES.filter((x) => x <= a).at(-1), hi = AGES.find((x) => x >= a);
  if (lo === hi) return t[lo];
  const f = (a - lo) / (hi - lo);
  return t[lo].map((v, k) => v + (t[hi][k] - v) * f);
}
// Stufe stufenlos 0–5 (0 = schwach … 4–5 = überragend) für das Fitness-Profil
export function vo2Score(v, age, sex) {
  const n = normsAt(age, sex);
  if (v < n[0]) return Math.max(0, (v / n[0]) * 1.5);
  for (let k = 0; k < 3; k++) if (v < n[k + 1]) return 1.5 + k + (v - n[k]) / (n[k + 1] - n[k]);
  return Math.min(5, 4.5 + (v - n[3]) / 10);
}
export function vo2Class(v, age, sex) {
  const n = normsAt(age, sex);
  const k = n.filter((x) => v >= x).length;
  return { k, name: VO2_CLASSES[k], next: k < 4 ? { name: VO2_CLASSES[k + 1], at: Math.round(n[k] * 10) / 10 } : null, norms: n };
}
// Fitnessalter: Alter, für das dein Wert genau «gut» (Mitte zwischen gut und ausgezeichnet) wäre
export function fitnessAge(v, sex) {
  const mid = (a) => { const n = normsAt(a, sex); return (n[1] + n[2]) / 2; };
  if (v >= mid(20)) return 20;
  for (let a = 20; a <= 80; a++) if (mid(a) <= v) return a;
  return 80;
}

// Verlauf: Tageswerte (Uhr) + VO2max-Tests, je Tag ein Wert
export function vo2Series(all = [], manual = []) {
  const m = new Map();
  for (const d of all) if (d.vo2max != null) m.set(d.day, { v: Number(d.vo2max), src: "Uhr" });
  for (const e of manual) if (e.kind === "test" && e.data?.test === "vo2") m.set(e.day, { v: Number(e.value), src: "Test" });
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, x]) => ({ day, ...x }));
}

export function vo2Summary(all, manual, { birth_year, sex } = {}, today = new Date().toISOString().slice(0, 10)) {
  const s = vo2Series(all, manual);
  if (!s.length) return null;
  // Aktuell = letzter Wert (wie auf der Uhr); Garmin glättet selbst
  const last = s.at(-1), cur = last.v;
  const before = (days) => { const t = new Date(new Date(today) - days * 864e5).toISOString().slice(0, 10); const x = s.filter((p) => p.day <= t).at(-1); return x && (new Date(today) - new Date(x.day)) / 864e5 < days + 45 ? x : null; };
  const d90 = before(90), d365 = before(365);
  const year = s.filter((p) => (new Date(today) - new Date(p.day)) / 864e5 <= 365);
  const best = year.reduce((b, p) => (!b || p.v > b.v ? p : b), null);
  const age = birth_year ? new Date(today).getFullYear() - Number(birth_year) : null;
  const sx = sex === "w" ? "w" : "m";
  const cls = age ? vo2Class(cur, age, sx) : null;
  return {
    cur: Math.round(cur * 10) / 10, day: last.day, src: last.src, age, sex: sx, sexAssumed: sex !== "m" && sex !== "w",
    d90: d90 ? Math.round((cur - d90.v) * 10) / 10 : null, d365: d365 ? Math.round((cur - d365.v) * 10) / 10 : null,
    best: best ? { v: best.v, day: best.day } : null, cls, fitAge: age ? fitnessAge(cur, sx) : null,
    score: age ? vo2Score(cur, age, sx) : null,
    pts: year.map((p) => p.v), n: s.length, stale: (new Date(today) - new Date(last.day)) / 864e5 > 30,
  };
}
