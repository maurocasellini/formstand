// Persönliche Trigger-Auswertung (N-of-1): Wie reagiert DEIN Körper am Morgen danach?
// Fairer Vergleich: Morgen nach dem Trigger vs. Morgen ohne Trigger am gleichen Wochentag (±10 Wochen),
// sonst alle triggerfreien Morgen im Umfeld von ±45 Tagen. Dazu Erholungsdauer und Dosis-Wirkung.
import { TRIGGERS, triggerName } from "./catalog";

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : null; };
const dow = (d) => new Date(d + "T12:00:00Z").getUTCDay();

// Abgeleiteter Trigger: Training spät am Abend (Start nach 19 Uhr Ortszeit)
export function lateTraining(activities) {
  const out = new Map();
  for (const a of activities) {
    if (a.category === "other") continue;
    const h = (new Date(a.start_time).getUTCHours() + 2) % 24;
    if (h >= 19) out.set(a.day, true);
  }
  return out;
}

const METRICS = [
  ["hrv", "HRV", "%", 1], ["rhr", "Ruhepuls", "bpm", -1], ["sleepScore", "Sleep Score", "Pkt.", 1], ["sleep", "Schlaf", "min", 1], ["score", "Tagesform", "Pkt.", 1],
];

// Mindest-Effekt, ab dem ein Unterschied praktisch relevant ist (sonst ist er auch bei vielen Fällen egal)
const MIN_EFFECT = { hrv: 3, rhr: 1, sleepScore: 3, sleep: 10, score: 4 };
function verdict(diffs, minN, key) {
  if (diffs.length < minN) return { level: "zu wenig Daten", t: null };
  const m = mean(diffs), s = sd(diffs);
  const t = s ? m / (s / Math.sqrt(diffs.length)) : 0;
  const relevant = Math.abs(m) >= (MIN_EFFECT[key] ?? 0);
  const level = !relevant ? "kein klarer Effekt" : Math.abs(t) >= 2.5 && diffs.length >= 10 ? "ziemlich sicher" : Math.abs(t) >= 1.5 && diffs.length >= 4 ? "Tendenz" : "kein klarer Effekt";
  return { level, t };
}

export function analyzeTriggers(all, activities = []) {
  // Trigger pro Abend (Tag des Eintrags) → wirkt auf den Morgen danach
  const late = lateTraining(activities);
  const evening = all.map((d) => {
    const list = (d.triggers || []).map((t) => ({ t: t.t, n: t.n || 1 }));
    if (late.get(d.day)) list.push({ t: "spaettraining", n: 1 });
    return list;
  });
  // Vergleichsmorgen: Vorabend ohne eingetragene Trigger. "Training spät" zählt dabei nicht, sonst blieben
  // vor allem Morgen nach Ruhetagen übrig (die ohnehin besser sind) und jeder Effekt wäre überschätzt.
  const manualEve = evening.map((l) => l.filter((x) => x.t !== "spaettraining"));
  const trainedEve = all.map((d) => (d.sessions || 0) > 0);
  const clean = all.map((d, i) => i > 0 && manualEve[i - 1].length === 0);
  const kinds = [...TRIGGERS.map((x) => x[0]), "spaettraining"];
  const res = [];
  for (const k of kinds) {
    let events = [];
    for (let i = 1; i < all.length; i++) {
      const ev = evening[i - 1].find((x) => x.t === k);
      // Nur "saubere" Abende: kein weiterer eingetragener Trigger am selben Abend
      if (ev) events.push({ i, n: ev.n, pure: manualEve[i - 1].filter((x) => x.t !== k).length === 0 });
    }
    if (!events.length) continue;
    const total = events.length;
    if (events.filter((e) => e.pure).length >= 3) events = events.filter((e) => e.pure);
    // Für "Training spät": Vergleich mit Abenden MIT Training, aber früher am Tag
    const isCtrl = (j) => clean[j] && (k !== "spaettraining" || (trainedEve[j - 1] && !evening[j - 1].some((x) => x.t === "spaettraining")));
    const perMetric = {};
    for (const [key, , unit] of METRICS) {
      const diffs = [], doseLo = [], doseHi = [];
      for (const e of events) {
        const v = all[e.i][key];
        if (v == null) continue;
        let ctrl = [];
        for (let j = Math.max(1, e.i - 70); j <= Math.min(all.length - 1, e.i + 70); j++) if (isCtrl(j) && dow(all[j].day) === dow(all[e.i].day) && all[j][key] != null) ctrl.push(all[j][key]);
        if (ctrl.length < 3) { ctrl = []; for (let j = Math.max(1, e.i - 45); j <= Math.min(all.length - 1, e.i + 45); j++) if (isCtrl(j) && all[j][key] != null) ctrl.push(all[j][key]); }
        if (ctrl.length < 3) continue;
        const base = mean(ctrl);
        const d = key === "hrv" ? ((v - base) / base) * 100 : key === "sleep" ? (v - base) * 60 : v - base;
        diffs.push(d);
        (e.n >= 3 ? doseHi : doseLo).push(d);
      }
      perMetric[key] = { diff: mean(diffs), n: diffs.length, unit, ...verdict(diffs, 3, key), doseLo: doseLo.length >= 3 ? mean(doseLo) : null, doseHi: doseHi.length >= 3 ? mean(doseHi) : null };
    }
    // Erholungsdauer: Tage, bis die HRV wieder im persönlichen Normalbereich ist (ohne neuen Trigger dazwischen)
    const rec = [];
    for (const e of events) {
      const ctrl = []; for (let j = Math.max(1, e.i - 45); j < e.i; j++) if (clean[j] && all[j].hrv != null) ctrl.push(all[j].hrv);
      if (ctrl.length < 7 || all[e.i].hrv == null) continue;
      const lo = mean(ctrl) - 0.5 * sd(ctrl);
      if (all[e.i].hrv >= lo) { rec.push(0); continue; }
      let days = null;
      for (let s = 1; s <= 5 && e.i + s < all.length; s++) {
        if (evening[e.i + s - 1].length) break;
        if (all[e.i + s].hrv != null && all[e.i + s].hrv >= lo) { days = s; break; }
      }
      if (days != null) rec.push(days);
    }
    const main = perMetric.hrv?.n >= 3 ? perMetric.hrv : perMetric.score;
    res.push({ k, name: k === "spaettraining" ? "Training spät abends" : triggerName(k), count: total, used: events.length, metrics: perMetric, recovery: rec.length >= 3 ? mean(rec) : null, recoveryN: rec.length, level: main?.level || "zu wenig Daten", strength: Math.abs(main?.t || 0) });
  }
  return res.sort((a, b) => (b.level === "ziemlich sicher") - (a.level === "ziemlich sicher") || b.strength - a.strength || b.count - a.count);
}

// Kurzer Satz für "Heute" und die Begründung: "Nach Alkohol: HRV −14 %, normal nach Ø 1.7 Tagen"
export function triggerLine(r) {
  const h = r.metrics.hrv;
  const parts = [];
  if (h?.diff != null && h.n >= 3) parts.push(`HRV ${h.diff > 0 ? "+" : "−"}${Math.abs(Math.round(h.diff))} %`);
  const rh = r.metrics.rhr;
  if (rh?.diff != null && rh.n >= 3 && Math.abs(rh.diff) >= 0.5) parts.push(`Ruhepuls ${rh.diff > 0 ? "+" : "−"}${Math.abs(rh.diff).toFixed(1)} bpm`);
  if (r.recovery != null && r.recovery >= 0.3 && r.level !== "kein klarer Effekt") parts.push(`normal nach Ø ${r.recovery.toFixed(1)} Tagen`);
  return parts.length ? `Nach ${r.name} bei dir: ${parts.join(", ")} (${r.count}×, ${r.level})` : null;
}
