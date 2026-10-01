// Intensitätsverteilung der letzten 4 Wochen (3-Zonen-Modell: locker / mittel / hart) –
// bewertet nie pauschal, sondern immer gegen ein Soll aus Ziel → Phase → Restzeit → Schwächen → aktueller Belastung.
import { EVENT_TYPES, WEAKNESSES } from "./catalog";

const LONG_EVENTS = ["rad_marathon", "gravel", "lauf_hm", "lauf_m", "trail", "tri_lang"];
const SHORT_EVENTS = ["rad_rennen", "lauf_10k", "tri_kurz", "hyrox", "hybrid", "crossfit"];
const pct = (a, t) => (t ? Math.round((a / t) * 100) : 0);

export function intensityDist(all, i = all.length - 1, days = 28) {
  const sl = all.slice(Math.max(0, i - days + 1), i + 1);
  const low = sl.reduce((s, d) => s + (d.low || 0), 0), mid = sl.reduce((s, d) => s + (d.mid || 0), 0), high = sl.reduce((s, d) => s + (d.high || 0), 0);
  const tot = low + mid + high, sessions = sl.reduce((s, d) => s + (d.sessions || 0), 0), exact = sl.reduce((s, d) => s + (d.ztExact || 0), 0);
  return { low: pct(low, tot), mid: pct(mid, tot), high: pct(high, tot), hours: Math.round(tot / 6) / 10, exact, sessions };
}

// Soll-Bereiche in % der Ausdauerzeit
export function intensityTarget({ goals = {}, phase = null, weak = [], loadRatio = null }) {
  const p = phase?.phase || "maintain", ev = phase?.event, t = ev?.type;
  const why = [];
  let T;
  if (p === "recovery") { T = { low: [88, 100], mid: [0, 10], high: [0, 3] }; why.push("Erholungsphase nach dem Wettkampf"); }
  else if (p === "base") { T = { low: [78, 92], mid: [6, 18], high: [0, 6] }; why.push("Grundlagenphase: Basis breit machen"); }
  else if (p === "build") { T = { low: [72, 85], mid: [10, 22], high: [4, 10] }; why.push("Aufbauphase"); }
  else if (p === "peak") {
    if (LONG_EVENTS.includes(t)) { T = { low: [65, 80], mid: [15, 28], high: [3, 8] }; why.push(`Wettkampfspezifisch für ${EVENT_TYPES[t]?.[0] || "Langdistanz"}: viel Renntempo im mittleren Bereich`); }
    else if (SHORT_EVENTS.includes(t)) { T = { low: [68, 82], mid: [8, 18], high: [8, 16] }; why.push(`Wettkampfspezifisch für ${EVENT_TYPES[t]?.[0] || "kurze Distanz"}: mehr harte Intervalle`); }
    else { T = { low: [70, 82], mid: [10, 22], high: [5, 12] }; why.push("Wettkampfspezifische Phase"); }
  } else if (p === "taper" || p === "raceweek") { T = { low: [70, 88], mid: [6, 20], high: [4, 12] }; why.push("Tapering: weniger Umfang, Intensität kurz halten"); }
  else if (goals.focus === "health" || goals.focus === "cut") { T = { low: [75, 92], mid: [5, 20], high: [0, 8] }; why.push(goals.focus === "cut" ? "Ziel Abnehmen: viel lockere Grundlage" : "Ziel Gesundheit"); }
  else { T = { low: [72, 88], mid: [8, 20], high: [3, 10] }; why.push("Form halten"); }

  // Schwächen verschieben das Soll leicht
  const sh = (k, d) => { T[k] = [Math.max(0, T[k][0] + d), Math.min(100, T[k][1] + d)]; };
  if (weak.some((w) => ["vo2", "sprint"].includes(w))) { sh("high", 2); why.push(`Schwäche ${WEAKNESSES[weak.find((w) => ["vo2", "sprint"].includes(w))][0]}`); }
  if (weak.some((w) => ["schwelle", "klettern", "langstrecke"].includes(w))) { sh("mid", 3); why.push(`Schwäche ${WEAKNESSES[weak.find((w) => ["schwelle", "klettern", "langstrecke"].includes(w))][0]}`); }
  if (weak.includes("grundlage")) { sh("low", 3); why.push("Schwäche Grundlagenausdauer"); }
  return { ...T, why, phase: p, daysTo: phase?.daysTo ?? null, loadRatio };
}

// Bewertung: Ist-Verteilung gegen Soll, mit Rücksicht auf Restzeit und aktuelle Belastung
export function intensityVerdict(dist, target) {
  if (!dist || dist.hours < 3 || dist.sessions < 4) return { level: "zu wenig Daten", lines: ["Für eine Aussage braucht es mindestens 4 Ausdauereinheiten und 3 Stunden in den letzten 4 Wochen."] };
  const lines = [], name = { low: "Lockerer Bereich", mid: "Mittlerer Bereich (Tempo/Schwelle)", high: "Harter Bereich (über der Schwelle)" };
  let off = 0;
  for (const k of ["high", "mid", "low"]) {
    const [a, b] = target[k], v = dist[k];
    if (v < a) { off++; lines.push(`${name[k]} ${v} % – für ${target.why[0]} eher zu wenig (Soll ${a}–${b} %).`); }
    else if (v > b) { off++; lines.push(`${name[k]} ${v} % – für ${target.why[0]} eher zu viel (Soll ${a}–${b} %).`); }
  }
  if (!off) lines.push(`Passt zu ${target.why.join(", ")}: locker ${dist.low} %, mittel ${dist.mid} %, hart ${dist.high} %.`);
  // Kontext: kurz vor dem Rennen nichts mehr umbauen; bei hoher Belastung nicht noch mehr Intensität
  if (off && target.daysTo != null && target.daysTo <= 14) lines.push("So kurz vor dem Wettkampf nicht mehr umbauen – Frische geht jetzt vor.");
  else if (off && target.loadRatio != null && target.loadRatio > 1.3 && dist.high + dist.mid > target.high[1] + target.mid[1] - 5) lines.push("Deine Belastung liegt gerade über deinem Schnitt – erst erholen, dann anpassen.");
  else if (off) {
    if (dist.high < target.high[0]) lines.push("Mehr harte Intervalle: Der Wochenplan setzt sie bereits ein – sie umzusetzen bringt die Verteilung ins Lot.");
    if (dist.mid < target.mid[0]) lines.push("Mehr Zeit im Tempo- und Schwellenbereich, z. B. Sweet Spot oder längere Anstiege im Renntempo.");
    if (dist.mid > target.mid[1]) lines.push("Weniger «mittelhart»: lockere Einheiten wirklich locker halten, harte wirklich hart.");
    if (dist.high > target.high[1]) lines.push("Die harten Anteile sind hoch – auf genug lockere Tage dazwischen achten.");
  }
  const approx = dist.exact < dist.sessions * 0.5;
  if (approx && off) lines.unshift("Grobe Einordnung – viele Einheiten ohne Zonenzeiten, darum mit Vorsicht lesen:");
  return { level: off ? "abweichend" : "passend", lines, approx };
}
