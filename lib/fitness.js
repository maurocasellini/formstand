// Fitness-Profil aus Kraft-, Lauf/Ruder- und Fitnesstests: jede Leistung gegen Normen (m/w) eingestuft,
// je Bereich (Schwäche) zusammengefasst → Vorschlag, woran wir arbeiten. Rein regelbasiert, keine KI.
import { TEST_TYPES, WEAKNESSES, e1rm, testText } from "./catalog";

export const LEVELS = ["unter Einsteiger", "Einsteiger", "Grundlage", "Fortgeschritten", "Stark", "Elite"];
const NORMED = (k) => TEST_TYPES[k]?.norms;
const r1 = (v) => Math.round(v * 10) / 10;

// Messgrösse, die mit den Normen verglichen wird
function metric(key, value, data = {}, kg = null) {
  const t = TEST_TYPES[key], v = Number(value);
  if (t.fmt === "lift") return kg ? e1rm(v, data.reps || 1) / kg : null;
  if (t.dur) return v / (Number(data.dur) || 1);
  return v;
}
// Normen bei Wiederholungen auf Zeit: pro Minute, längere Dauer → tieferes Tempo
const normsFor = (key, sex, data = {}) => {
  const t = TEST_TYPES[key], n = t.norms[sex] || t.norms.m;
  return t.dur ? n.map((x) => x * Math.pow(Number(data.dur) || 1, -0.29)) : n;
};
// Stufe 0–5 stufenlos (z. B. 3,4 = Fortgeschritten, Richtung Stark)
export function scoreOf(key, m, sex, data) {
  if (m == null || !NORMED(key)) return null;
  const t = TEST_TYPES[key], n = normsFor(key, sex, data);
  const lower = t.better === 1 || t.fmt === "lift" ? false : true; // Zeiten: kleiner ist besser
  const better = (a, b) => (lower ? a <= b : a >= b);
  if (!better(m, n[0])) return Math.min(0.99, Math.max(0, lower ? n[0] / m : m / n[0]));
  for (let i = 0; i < 4; i++) if (!better(m, n[i + 1])) return i + 1 + (m - n[i]) / (n[i + 1] - n[i]);
  return 5;
}
export const levelName = (s) => (s == null ? "–" : LEVELS[Math.max(0, Math.min(5, Math.floor(s + 1e-9)))]);

// Welche Bereiche für das aktuelle Ziel besonders zählen
function relevant(goals = {}, profile = {}) {
  const ev = (goals.events || []).filter((e) => e.priority === "A").sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const t = `${ev?.type || ""} ${profile.sport || ""}`;
  if (/hyrox|hybrid|crossfit/i.test(t)) return ["hyrox_stationen", "kraftausdauer", "kraft_beine", "kraft_ober", "vo2"];
  if (/lauf|trail|run/i.test(t)) return ["lauftempo", "vo2", "grundlage", "sprint", "rumpf"];
  if (/rad|gravel|bike|cycl/i.test(t)) return ["vo2", "kraft_beine", "rumpf", "sprint"];
  if (/tri/i.test(t)) return ["lauftempo", "vo2", "grundlage", "rumpf"];
  if (goals.focus === "muscle") return ["kraft_beine", "kraft_ober", "rumpf"];
  return [];
}

export function fitnessProfile(manual = [], { sex, kg, goals = {}, profile = {}, today = new Date().toISOString().slice(0, 10), vo2 = null } = {}) {
  const sx = sex === "w" ? "w" : "m";
  const byKey = {};
  for (const e of manual.filter((x) => x.kind === "test" && NORMED(x.data?.test)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1))) (byKey[e.data.test] ||= []).push(e);
  const tests = [];
  for (const [key, list] of Object.entries(byKey)) {
    const t = TEST_TYPES[key];
    // Burpees/Wall Balls: nur gleiche Dauer direkt vergleichen
    const cur = list[0], prev = list.slice(1).find((x) => !t.dur || Number(x.data?.dur || 1) === Number(cur.data?.dur || 1));
    const m = metric(key, cur.value, cur.data, kg), s = scoreOf(key, m, sx, cur.data);
    const ps = prev ? scoreOf(key, metric(key, prev.value, prev.data, kg), sx, prev.data) : null;
    const age = Math.round((new Date(today) - new Date(cur.day)) / 864e5);
    tests.push({
      key, name: t.name, group: t.group, area: t.area, day: cur.day, id: cur.id, text: testText(key, cur.value, cur.data),
      extra: t.fmt === "lift" ? (kg ? `${r1(m).toLocaleString("de-CH")}× Körpergewicht` : "Körpergewicht fehlt") : null,
      score: s, level: levelName(s), age, due: age > (t.wks || 8) * 7,
      prev: prev ? { day: prev.day, text: testText(key, prev.value, prev.data), score: ps } : null,
      delta: s != null && ps != null ? r1(s - ps) : null,
      e1rm: t.fmt === "lift" ? e1rm(Number(cur.value), cur.data?.reps || 1) : null,
    });
  }
  // VO2max von der Uhr (nach Alter/Geschlecht eingestuft) zählt für den Bereich VO2max
  if (vo2?.score != null && !byKey.vo2) tests.push({ key: "vo2max", name: "VO2max (Uhr)", group: "ausdauer", area: "vo2", day: vo2.day, text: `${vo2.cur} ml/kg/min`, extra: vo2.cls?.name || null, score: vo2.score, level: levelName(vo2.score), age: 0, due: false, prev: null, delta: null });
  // Bereiche: Mittel der Tests (jüngere Tests zählen gleich – ein alter Test macht den Bereich unsicher)
  const areas = {};
  for (const x of tests.filter((x) => x.score != null)) (areas[x.area] ||= { area: x.area, name: WEAKNESSES[x.area]?.[0] || x.area, tests: [] }).tests.push(x);
  for (const a of Object.values(areas)) { a.score = a.tests.reduce((s, x) => s + x.score, 0) / a.tests.length; a.level = levelName(a.score); }
  const rel = relevant(goals, profile);
  const list = Object.values(areas);
  const mean = list.length ? list.reduce((s, a) => s + a.score, 0) / list.length : null;
  // Woran wir arbeiten: schwächste Bereiche, fürs Ziel relevante zuerst; nur wenn klar unter dem eigenen Schnitt oder tief
  const suggest = list
    .map((a) => ({ ...a, relevant: rel.includes(a.area), rank: a.score - (rel.includes(a.area) ? 0.6 : 0) }))
    .filter((a) => a.score < 2.5 || (mean != null && a.score < mean - 0.7))
    .sort((a, b) => a.rank - b.rank).slice(0, 3);
  const strong = list.filter((a) => a.score >= 3.5 || (mean != null && list.length > 2 && a.score > mean + 0.8)).sort((a, b) => b.score - a.score).slice(0, 3);
  return { tests, areas, suggest, strong, mean, overall: levelName(mean), sex: sx, sexAssumed: sex !== "w" && sex !== "m", kg };
}

// Für KI-Kontexte: kompakte Liste
export const fitnessBrief = (fp) => (fp?.tests?.length ? {
  stufe_gesamt: fp.overall,
  tests: fp.tests.map((x) => ({ test: x.name, ergebnis: x.text, stufe: x.level, datum: x.day, vorher: x.prev?.text || null })),
  schwaechste_bereiche: fp.suggest.map((a) => a.name), staerken: fp.strong.map((a) => a.name),
} : null);
