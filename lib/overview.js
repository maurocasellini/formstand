// Übersicht: Trends mit Verlauf, «Was auffällt» (automatisch erkannte Muster) und Wochenstand.
// Rein regelbasiert aus der Tagesreihe – jede Aussage nennt ihre Zahlen.
import { addDays } from "./metrics";

const mean = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const sd = (a) => { const x = a.filter((v) => v != null), m = mean(x); return x.length > 2 ? Math.sqrt(mean(x.map((v) => (v - m) ** 2))) : null; };
const r1 = (v) => Math.round(v * 10) / 10;
const fmtD = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const sg = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;

// Wert + Baseline (Ø und Streuung der 28 Tage davor) für die letzten n Tage
function seriesOf(all, key, n = 28) {
  const i = all.length - 1;
  const pts = all.slice(Math.max(0, i - n + 1)).map((d) => ({ day: d.day, v: d[key] ?? null }));
  const base = all.slice(Math.max(0, i - n - 27), Math.max(0, i - n + 1)).map((d) => d[key]);
  const prev28 = all.slice(Math.max(0, i - 28), i).map((d) => d[key]);
  return { pts, m: mean(prev28), s: sd(prev28), mOld: mean(base) };
}
// Tage in Folge (bis heute bzw. letzter Wert), an denen die Bedingung gilt
function streak(all, f) {
  let n = 0;
  for (let i = all.length - 1; i >= 0 && n < 60; i--) { const r = f(all[i], i); if (r === null) continue; if (!r) break; n++; }
  return n;
}

// Kennzahlen-Kacheln mit Verlauf (28 Tage) und Einordnung
const TILES = [
  ["hrv", "HRV", "ms", 1, 0], ["rhr", "Ruhepuls", "bpm", -1, 0], ["sleep", "Schlaf", "h", 1, 1], ["score", "Bereitschaft", "", 1, 0],
  ["ctl", "Fitness (CTL)", "", 1, 0], ["tsb", "Form (TSB)", "", 0, 0], ["weight", "Gewicht", "kg", 0, 1], ["vo2max", "VO2max", "", 1, 1],
];
export function trendTiles(all, vo2 = null) {
  const out = [];
  for (const [k, label, unit, dir, dec] of TILES) {
    const s = seriesOf(all, k);
    const vals = s.pts.map((p) => p.v).filter((v) => v != null);
    if (vals.length < 5) continue;
    const last = [...s.pts].reverse().find((p) => p.v != null);
    const cur = last.v, m7 = mean(s.pts.slice(-7).map((p) => p.v)), mPrev = mean(s.pts.slice(-14, -7).map((p) => p.v));
    let text = null, tone = "";
    if (k === "ctl") { const old = s.pts[0].v; const d = cur - old; text = `${sg(d)} in 4 Wochen`; tone = d > 2 ? "good" : d < -3 ? "warn" : ""; }
    else if (k === "tsb") { text = cur > 15 ? "sehr frisch – Form nutzen" : cur > 5 ? "frisch" : cur > -10 ? "ausgeglichen" : cur > -25 ? "Aufbau-Ermüdung" : "stark ermüdet"; tone = cur < -25 ? "crit" : cur > 25 ? "warn" : ""; }
    else if (k === "weight") { if (m7 != null && mPrev != null) { const d = m7 - mPrev; text = `Ø 7 T ${sg(d, 1)} kg zur Vorwoche`; } }
    else if (s.m != null) {
      const d = k === "hrv" ? ((cur / s.m) - 1) * 100 : cur - s.m;
      const z = s.s ? (cur - s.m) / s.s : 0;
      text = k === "hrv" ? `${sg(d)} % vs. Ø ${Math.round(s.m)}` : k === "sleep" ? `${sg(d * 60)} min vs. Ø ${s.m.toFixed(1)}` : `${sg(d, dec)} vs. Ø ${s.m.toFixed(dec)}`;
      tone = dir === 0 ? "" : dir * z > 0.7 ? "good" : dir * z < -1 ? "crit" : dir * z < -0.5 ? "warn" : "";
      // VO2max bewegt sich langsam: erst ab 1 Punkt einfärben
      if (k === "vo2max") tone = Math.abs(d) < 1 ? "" : d > 0 ? "good" : "warn";
    }
    if (k === "vo2max" && vo2?.cls) text = `${vo2.cls.name} für ${vo2.age} J.${vo2.fitAge != null ? ` · Fitnessalter ${vo2.fitAge <= 20 ? "≤ 20" : `≈ ${vo2.fitAge}`}` : ""}`;
    out.push({ k, label, unit, cur: Number(cur.toFixed(dec)), day: last.day, stale: last.day !== all.at(-1).day, text, tone, pts: s.pts.map((p) => p.v), m: s.m, s: s.s, dir });
  }
  return out;
}

// «Was auffällt»: erkannte Muster, wichtigste zuerst (prio hoch = oben)
export function findings(all, { activities = [], st = null, goals = {}, triggers = [] } = {}) {
  const T = all.at(-1), i = all.length - 1, F = [];
  if (!T || all.length < 35) return F;
  const add = (prio, tone, title, text) => F.push({ prio, tone, title, text });
  const base = (k) => { const p = all.slice(Math.max(0, i - 28), i).map((d) => d[k]); return { m: mean(p), s: sd(p) }; };
  const bh = base("hrv"), br = base("rhr"), bs = base("sleep");
  const load7 = all.slice(-7).reduce((s, d) => s + (d.load || 0), 0), load28 = all.slice(-35, -7).reduce((s, d) => s + (d.load || 0), 0) / 4;
  const ratio = load28 > 20 ? load7 / load28 : null;

  // 1) HRV tief / Ruhepuls hoch über mehrere Tage
  const hrvLow = bh.m ? streak(all, (d) => (d.hrv == null ? null : d.hrv < bh.m * 0.9)) : 0;
  const rhrHigh = br.m ? streak(all, (d) => (d.rhr == null ? null : d.rhr > br.m + 2)) : 0;
  if (hrvLow >= 2 && rhrHigh >= 2) {
    const why = ratio != null && ratio < 0.85 ? "obwohl du zuletzt weniger als üblich trainiert hast – die Ursache liegt eher ausserhalb des Trainings (Infekt, Stress, Schlaf, Alkohol)" : "nach höherer Belastung – klassische Ermüdung";
    add(95, "crit", "HRV tief und Ruhepuls hoch", `Seit ${Math.min(hrvLow, rhrHigh)} Tagen beides gleichzeitig: HRV ${Math.round(T.hrv ?? 0)} ms (Ø ${Math.round(bh.m)}), Ruhepuls ${Math.round(T.rhr ?? 0)} (Ø ${Math.round(br.m)}), ${why}. Bei Halskratzen oder Fieber: Pause.`);
  } else if (hrvLow >= 3) add(80, "warn", `HRV seit ${hrvLow} Tagen unter deinem Normalbereich`, `Aktuell ${Math.round(T.hrv ?? 0)} ms vs. Ø ${Math.round(bh.m)} ms. Mehrere Tage in Folge sind aussagekräftiger als ein einzelner Morgen.`);
  else if (rhrHigh >= 3) add(80, "warn", `Ruhepuls seit ${rhrHigh} Tagen erhöht`, `${Math.round(T.rhr ?? 0)} bpm vs. Ø ${Math.round(br.m)} – oft das früheste Zeichen für einen Infekt oder zu wenig Erholung.`);
  else if (T.hrv != null && bh.m && bh.s && (T.hrv - bh.m) / bh.s < -1.5 && ratio != null && ratio < 0.85) add(75, "warn", "HRV-Einbruch ohne Trainingsgrund", `HRV ${Math.round(T.hrv)} ms (${sg(((T.hrv / bh.m) - 1) * 100)} %) bei nur ${ratio.toFixed(1)}× deiner üblichen Wochenlast. Schlaf, Stress, Alkohol oder ein beginnender Infekt sind wahrscheinlicher als das Training.`);

  // 2) Schlaf: Schuld oder fehlende Daten
  const noSleep = streak(all, (d) => d.sleep == null);
  if (noSleep >= 2) add(70, "warn", `Seit ${noSleep} Nächten keine Schlafdaten`, "Ohne Schlaf ist die Einschätzung unsicherer. Uhr nachts tragen und in intervals.icu bei der Garmin-Verbindung die Schlaf-/Wellness-Daten erlauben.");
  else if (bs.m) {
    const debt = all.slice(-5).reduce((s, d) => s + (d.sleep != null ? Math.max(0, bs.m - d.sleep) : 0), 0);
    if (debt > 2) add(65, "warn", `Schlafschuld ${debt.toFixed(1)} h in 5 Nächten`, `Dein Ø liegt bei ${bs.m.toFixed(1)} h. Zwei längere Nächte gleichen das meist aus – vor harten Einheiten einplanen.`);
  }

  // 3) Belastung: Spitze, Einbruch, Fitness-Trend
  if (ratio != null && ratio > 1.5) add(78, "warn", "Belastungsspitze", `Letzte 7 Tage ${ratio.toFixed(1)}× deines Wochenschnitts. Über 1,5× steigt das Verletzungs- und Infektrisiko – die nächsten Tage dosieren.`);
  const ctlNow = T.ctl, ctl6 = all[Math.max(0, i - 42)]?.ctl, ctl2 = all[Math.max(0, i - 14)]?.ctl;
  if (ctlNow != null && ctl6 > 5) {
    const d6 = ((ctlNow / ctl6) - 1) * 100;
    if (d6 > 8) add(40, "good", `Fitness ${sg(d6)} % in 6 Wochen`, `CTL von ${Math.round(ctl6)} auf ${Math.round(ctlNow)} – der Aufbau greift.`);
    else if (ctl2 && (ctlNow / ctl2 - 1) * 100 < -10) add(55, "warn", `Fitness sinkt: ${sg((ctlNow / ctl2 - 1) * 100)} % in 2 Wochen`, `CTL ${Math.round(ctl2)} → ${Math.round(ctlNow)}. Kurze Pausen sind gut – länger als 2 Wochen kostet es Form.`);
  }
  if (T.tsb > 20 && st?.states?.cardio?.value >= 55) add(50, "good", "Du bist frisch", `Form (TSB) ${Math.round(T.tsb)} und Herz-Kreislauf bereit – gute Tage für einen Test oder eine Schlüsseleinheit.`);

  // 4) Bestwerte der letzten 12 Monate
  const year = all.slice(Math.max(0, i - 365), i);
  const minRhr = Math.min(...year.map((d) => d.rhr).filter((v) => v != null));
  if (T.rhr != null && Number.isFinite(minRhr) && T.rhr <= minRhr) add(45, "good", "Tiefster Ruhepuls seit 12 Monaten", `${Math.round(T.rhr)} bpm – ein Zeichen für gute Grundform und Erholung.`);
  const hrv7 = mean(all.slice(-7).map((d) => d.hrv)), hrvYear = year.map((d, k) => mean(year.slice(Math.max(0, k - 6), k + 1).map((x) => x.hrv))).filter((v) => v != null);
  if (hrv7 && hrvYear.length > 60 && hrv7 >= Math.max(...hrvYear)) add(45, "good", "Höchste HRV-Woche seit 12 Monaten", `Ø 7 Tage ${Math.round(hrv7)} ms.`);

  // 5) Regelmässigkeit: Wochen mit mindestens 3 Einheiten
  let weeks = 0;
  for (let w = 0; w < 104; w++) { const sl = all.slice(Math.max(0, i - 7 * (w + 1) + 1), i - 7 * w + 1); if (sl.reduce((s, d) => s + (d.sessions || 0), 0) >= 3) weeks++; else break; }
  if (weeks >= 4) add(35, "good", weeks >= 52 ? "Seit über einem Jahr jede Woche dran" : `${weeks} Wochen in Folge dran`, "Jede Woche mindestens 3 Einheiten – Regelmässigkeit bringt mehr als einzelne Spitzen.");
  const idle = streak(all, (d) => (d.sessions || 0) === 0);
  if (idle >= 5) add(60, "warn", `${idle} Tage ohne Training`, "Fehlt eine Einheit in den Daten? Sonst: locker wieder einsteigen, erst Grundlage, dann Intensität.");

  // 6) Alkohol: Häufung und persönliche Wirkung
  const alcN = all.slice(-14).filter((d) => (d.triggers || []).some((t) => t.t === "alkohol")).length;
  const alcR = triggers.find((t) => t.k === "alkohol");
  if (alcN >= 4 && alcR?.metrics?.hrv?.diff != null && alcR.metrics.hrv.diff < -3) add(58, "warn", `${alcN} Abende mit Alkohol in 2 Wochen`, `Bei dir kostet ein Abend mit Alkohol im Schnitt ${Math.abs(Math.round(alcR.metrics.hrv.diff))} % HRV am Morgen danach.`);

  // 7) Gewicht: Trend 4 Wochen vs. Ziel
  const w4 = mean(all.slice(-35, -28).map((d) => d.weight)), wNow = mean(all.slice(-7).map((d) => d.weight));
  if (w4 && wNow) {
    const d = wNow - w4, tw = Number(goals.targetWeight) || null;
    if (Math.abs(d) >= 0.6) add(30, tw && Math.sign(tw - w4) === Math.sign(d) ? "good" : "", `Gewicht ${sg(d, 1)} kg in 4 Wochen`, `Ø 7 Tage ${wNow.toFixed(1)} kg${tw ? `, Ziel ${tw} kg` : ""}.`);
  }

  // 8) Nicht bewertete Einheiten machen die Muskel-Einschätzung ungenau
  const unrated = activities.filter((a) => a.category !== "other" && !a.rpe && a.day >= addDays(T.day, -7)).length;
  if (unrated >= 3) add(20, "", `${unrated} Einheiten ohne Gefühl`, "Ein Tipp «Wie hart war's?» pro Einheit macht Muskulatur und Belastung deutlich genauer.");

  return F.sort((a, b) => b.prio - a.prio);
}

// Wochenstand: Plan vs. Ist je Tag (Mo–So)
export function weekStatus(week = [], all = [], activities = [], today) {
  if (!week?.length) return null;
  const byDay = new Map(all.map((d) => [d.day, d]));
  const days = week.map((p) => {
    const d = byDay.get(p.day) || {}, acts = activities.filter((a) => a.day === p.day && a.category !== "other");
    const doneMin = acts.reduce((s, a) => s + Math.round(a.duration_s / 60), 0);
    const past = p.day < today, isToday = p.day === today;
    const planned = p.type === "rest" ? 0 : p.min || 0;
    let status = "offen";
    if (past || (isToday && doneMin)) status = planned === 0 ? (doneMin ? "zusätzlich" : "ruhe") : doneMin >= planned * 0.7 ? "erledigt" : doneMin > 0 ? "teilweise" : "verpasst";
    return { day: p.day, title: p.title, type: p.type, planned, doneMin, acts: acts.map((a) => a.name || a.sport), status, isToday, load: d.load || 0 };
  });
  const plannedMin = days.reduce((s, x) => s + x.planned, 0), doneMin = days.reduce((s, x) => s + x.doneMin, 0);
  const soFar = days.filter((x) => x.day <= today), plannedSoFar = soFar.reduce((s, x) => s + x.planned, 0);
  const key = days.filter((x) => ["quality", "long", "race"].includes(x.type));
  return { days, plannedMin, doneMin, plannedSoFar, key, keyDone: key.filter((x) => x.status === "erledigt").length };
}
