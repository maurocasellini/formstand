// Rückblick & Feedback für Zeiträume: Kennzahlen gegen vorher, «Das lief gut», «Daran arbeiten», nächster Schritt.
// Regelbasiert; die KI kann daraus auf Knopfdruck ein persönliches Coach-Feedback schreiben.
import { periodReview } from "./weekly";
import { addDays } from "./metrics";

const mean = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const sg = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;
const fmtD = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5) + 1;

// Zeiträume relativ zu heute
export function periods(today) {
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7, mon = addDays(today, -dow);
  return [
    { key: "woche", label: "Diese Woche", from: mon, to: today, running: true },
    { key: "vorwoche", label: "Letzte Woche", from: addDays(mon, -7), to: addDays(mon, -1) },
    { key: "monat", label: "30 Tage", from: addDays(today, -29), to: today },
    { key: "gesamt", label: "Gesamtbild · 90 Tage", from: addDays(today, -89), to: today },
  ];
}

// Ein Zeitraum im Vergleich zum gleich langen Zeitraum davor
export function periodFeedback(all, rows, P, { goals = {}, targets = [], vo2 = null } = {}) {
  const n = days(P.from, P.to);
  const cur = periodReview(all, rows, P.from, P.to);
  const prevFrom = addDays(P.from, -n), prevTo = addDays(P.from, -1);
  const prev = periodReview(all, rows, prevFrom, prevTo);
  const D = all.filter((d) => d.day >= P.from && d.day <= P.to), Dp = all.filter((d) => d.day >= prevFrom && d.day <= prevTo);
  const at = (day) => all.find((d) => d.day === day) || null;
  const ctlA = at(addDays(P.from, -1))?.ctl ?? D[0]?.ctl, ctlB = D.at(-1)?.ctl;
  const rhr = r1(mean(D.map((d) => d.rhr))), rhrP = r1(mean(Dp.map((d) => d.rhr)));
  // Für eine laufende Woche: Stunden hochrechnen wäre spekulativ – wir vergleichen mit dem gleichen Stand der Vorwoche
  const prevSame = P.running ? periodReview(all, rows, prevFrom, addDays(prevFrom, n - 1)) : prev;
  const k = {
    hours: cur.hours, hoursPrev: prevSame.hours, sessions: cur.sessions, sessionsPrev: prevSame.sessions,
    quality: cur.quality, strength: cur.strength, adherence: cur.adherence,
    score: cur.score, scorePrev: prev.score, hrv: cur.hrv, hrvPrev: prev.hrv, rhr, rhrPrev: rhrP, sleep: cur.sleep, sleepPrev: prev.sleep,
    alc: cur.alc, alcPrev: prev.alc, weightDelta: cur.weightDelta,
    ctlDelta: ctlA != null && ctlB != null ? r1(ctlB - ctlA) : null, ctl: ctlB != null ? Math.round(ctlB) : null,
    focus: cur.focus, focusPlan: cur.focusPlan, best: cur.best, off: cur.off,
  };

  const good = [], work = [];
  const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null);
  // Training
  if (k.adherence != null && k.adherence >= 80 && rows.some((r) => r.day >= P.from && r.day <= P.to)) good.push(`Plan-Treue ${k.adherence} % – du hast den Plan sehr gut umgesetzt.`);
  else if (k.adherence != null && k.adherence < 55) work.push(`Plan-Treue ${k.adherence} %${k.off.length ? `; ${k.off.length}× härter als empfohlen (${k.off.slice(0, 2).map((o) => `${fmtD(o.day)} ${o.did}`).join(", ")})` : ""}. Lieber den Plan anpassen, als ihn zu umgehen.`);
  if (k.focusPlan >= 2) (k.focus / k.focusPlan >= 0.7 ? good : work).push(`${k.focus} von ${k.focusPlan} Fokus-Einheiten für deine Schwächen umgesetzt.`);
  const dh = pct(k.hours, k.hoursPrev);
  if (!P.running && dh != null && Math.abs(dh) >= 20) (dh > 0 ? (dh > 40 ? work : good) : work).push(`Trainingszeit ${k.hours} h (${sg(dh)} % zum Zeitraum davor)${dh > 40 ? " – grosser Sprung, Erholung im Blick behalten" : ""}.`);
  if (k.ctlDelta != null && n >= 14) { if (k.ctlDelta >= 3) good.push(`Fitness (CTL) ${sg(k.ctlDelta)} auf ${k.ctl} – der Aufbau wirkt.`); else if (k.ctlDelta <= -4) work.push(`Fitness (CTL) ${sg(k.ctlDelta)} auf ${k.ctl} – zu wenig Reiz, um die Form zu halten.`); }
  if (n >= 7 && k.quality === 0 && k.sessions >= 3) work.push("Keine harte Ausdauereinheit – ohne Intensität stagnieren VO2max und Schwelle.");
  // Erholung
  if (k.hrv != null && k.hrvPrev) { const d = pct(k.hrv, k.hrvPrev); if (d >= 5) good.push(`HRV im Schnitt ${Math.round(k.hrv)} ms (${sg(d)} %) – du erholst dich gut.`); else if (d <= -7) work.push(`HRV im Schnitt ${Math.round(k.hrv)} ms (${sg(d)} %) – Erholung, Schlaf und Stress prüfen.`); }
  if (k.rhr != null && k.rhrPrev != null) { const d = k.rhr - k.rhrPrev; if (d <= -1.5) good.push(`Ruhepuls im Schnitt ${sg(d, 1)} bpm – Zeichen für bessere Grundform.`); else if (d >= 2) work.push(`Ruhepuls im Schnitt ${sg(d, 1)} bpm – Ermüdung oder Infekt?`); }
  if (k.sleep != null) { if (k.sleep < 6.8) work.push(`Ø Schlaf nur ${k.sleep} h – das ist der einfachste Hebel für mehr Bereitschaft.`); else if (k.sleepPrev && k.sleep - k.sleepPrev >= 0.25) good.push(`Ø Schlaf ${k.sleep} h (${sg((k.sleep - k.sleepPrev) * 60)} min).`); }
  if (k.alc >= Math.max(3, n / 4)) work.push(`${k.alc} Abende mit Alkohol – kostet messbar Erholung.`);
  else if (k.alcPrev >= 3 && k.alc <= k.alcPrev / 2) good.push(`Weniger Alkohol (${k.alc} statt ${k.alcPrev} Abende).`);
  // Körper und Ziele
  if (k.weightDelta != null && Math.abs(k.weightDelta) >= (n <= 7 ? 1 : 0.5) && goals.targetWeight) {
    const toward = Math.sign(goals.targetWeight - (D.find((d) => d.weight != null)?.weight ?? 0)) === Math.sign(k.weightDelta);
    (toward ? good : work).push(`Gewicht ${sg(k.weightDelta, 1)} kg ${toward ? "– Richtung Ziel" : "– weg vom Ziel"} (${goals.targetWeight} kg).`);
  }
  for (const t of targets.filter((t) => !t.free)) {
    if (t.status === "auf Kurs" || t.status === "erreicht") good.push(`Ziel ${t.name}: ${t.status} (${t.curTxt} → ${t.targetTxt}).`);
    else if (t.status === "hinter Plan" || t.status === "knapp hinter Plan") work.push(`Ziel ${t.name}: ${t.status}${t.perWeekTxt ? ` – nötig ${t.perWeekTxt}` : ""}.`);
  }
  if (P.key === "gesamt" && vo2?.d90 != null && Math.abs(vo2.d90) >= 0.8) (vo2.d90 > 0 ? good : work).push(`VO2max ${sg(vo2.d90, 1)} in 3 Monaten (jetzt ${vo2.cur}${vo2.cls ? `, ${vo2.cls.name}` : ""}).`);

  // Gesamturteil und nächster Schritt
  const score = good.length - work.length;
  const headline = !D.some((d) => d.sessions || d.hrv != null) ? "Zu wenig Daten für diesen Zeitraum"
    : score >= 2 ? "Starker Zeitraum – weiter so" : score >= -1 ? "Solide, mit Luft nach oben" : "Holprig – Zeit nachzujustieren";
  const next = work.find((w) => /Schlaf/.test(w)) ? "Diese Woche: 3 Nächte mit mindestens 7,5 h einplanen."
    : work.find((w) => /Plan-Treue|härter/.test(w)) ? "Diese Woche: den Plan an deinen Alltag anpassen (Ziele & Plan → Anpassen), statt ihn zu überspringen."
    : work.find((w) => /Intensität|harte/.test(w)) ? "Diese Woche: eine Qualitätseinheit fix einplanen, z. B. 4×4 min VO2max."
    : work.find((w) => /HRV|Ruhepuls/.test(w)) ? "Diese Woche: zwei ruhige Tage, früher ins Bett, Alkohol weglassen – dann neu bewerten."
    : work.find((w) => /^Ziel /.test(w)) ? "Diese Woche: Fokus auf das Ziel, das hinter Plan ist – die Fokus-Einheiten im Wochenplan priorisieren."
    : work.find((w) => /Alkohol/.test(w)) ? "Diese Woche: höchstens ein Abend mit Alkohol – und am Morgen danach die HRV vergleichen."
    : work.find((w) => /Fokus-Einheiten/.test(w)) ? "Diese Woche: die Fokus-Einheiten im Wochenplan zuerst erledigen – sie bringen dich am meisten weiter."
    : good.length ? "So weitermachen – und in 6–8 Wochen einen Test einplanen, um den Fortschritt zu messen." : null;
  return { ...P, n, k, good: good.slice(0, 5), work: work.slice(0, 5), headline, tone: score >= 2 ? "good" : score >= -1 ? "" : "warn", next };
}

// Kompakt für die KI
export const feedbackBrief = (f) => ({
  zeitraum: `${f.label} (${f.from} bis ${f.to})`, laufend: Boolean(f.running),
  kennzahlen: { stunden: f.k.hours, stunden_vorher: f.k.hoursPrev, einheiten: f.k.sessions, harte_einheiten: f.k.quality, kraft_tage: f.k.strength, plan_treue_pct: f.k.adherence, fokus_einheiten: `${f.k.focus}/${f.k.focusPlan}`, bereitschaft_avg: f.k.score, bereitschaft_vorher: f.k.scorePrev, hrv_avg: f.k.hrv, hrv_vorher: f.k.hrvPrev, ruhepuls_avg: f.k.rhr, ruhepuls_vorher: f.k.rhrPrev, schlaf_avg_h: f.k.sleep, schlaf_vorher_h: f.k.sleepPrev, alkohol_abende: f.k.alc, gewicht_delta_kg: f.k.weightDelta, fitness_ctl: f.k.ctl, fitness_delta: f.k.ctlDelta },
  gut: f.good, verbessern: f.work, urteil: f.headline,
});
