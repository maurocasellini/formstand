// Feedback-Schleife: Empfohlen → gemacht → Belastung → Reaktion → nächste Empfehlung.
// Aus allen bisherigen harten Ausdauertagen lernt Formstand, wie DU darauf reagierst:
//  - ab welcher Bereitschaft am Morgen du harte Einheiten gut verkraftest (Bereitschaft am Folgetag),
//  - wie viele Tage du brauchst, bis du wieder auf dem Ausgangsniveau bist.
// Daraus werden zwei Regeln der Entscheidung persönlich – in engen Grenzen und erst ab genug Daten.
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DEFAULT_Q_MIN = 50, DEFAULT_GAP = 2;
const OK_DROP = -10; // Folgetag höchstens 10 Punkte tiefer gilt als „gut verkraftet“

export function learn(all, upto = all.length - 1) {
  const pairs = [], rec = [], easy = [];
  for (let i = Math.max(1, upto - 240); i < upto; i++) {
    const d = all[i], n = all[i + 1];
    if (d?.score == null || n?.score == null) continue;
    const hard = (d.hardSessions || []).some((h) => h.category === "end");
    if (!hard) { if (d.sessions) easy.push(n.score - d.score); continue; }
    pairs.push({ s: d.score, delta: n.score - d.score, day: d.day });
    // Erholungsdauer: Tage bis die Bereitschaft wieder das Niveau vor der harten Einheit erreicht (max. 5)
    let k = 1;
    while (k <= 5 && i + k <= upto && (all[i + k].score == null || all[i + k].score < d.score - 3)) k++;
    if (k <= 5 && i + k <= upto) rec.push(k);
  }
  const out = { n: pairs.length, qMin: null, gap: null, afterHard: mean(pairs.map((p) => p.delta)), afterEasy: easy.length >= 5 ? mean(easy) : null, recoveryDays: rec.length >= 5 ? mean(rec) : null, bands: [] };
  if (pairs.length < 8) return out;

  // Bänder der Morgen-Bereitschaft: wie stark fällt der Folgetag im Schnitt?
  for (let lo = 30; lo < 90; lo += 10) {
    const p = pairs.filter((x) => x.s >= lo && x.s < lo + 10);
    if (p.length >= 3) out.bands.push({ lo, n: p.length, delta: mean(p.map((x) => x.delta)) });
  }
  // Niedrigstes Band, ab dem alle höheren Bänder gut verkraftet werden
  let qMin = null;
  for (let j = out.bands.length - 1; j >= 0; j--) { if (out.bands[j].delta >= OK_DROP) qMin = out.bands[j].lo; else break; }
  if (qMin != null) out.qMin = clamp(qMin, 42, 62);
  // Wer nach 1 Tag zuverlässig zurück ist, darf 1 Tag Abstand halten; wer > 2,5 Tage braucht, 3 Tage
  if (out.recoveryDays != null) out.gap = out.recoveryDays <= 1.3 ? 1 : out.recoveryDays > 2.5 ? 3 : 2;
  return out;
}

// Ein Satz für die Oberfläche
export function learnedText(l) {
  if (!l || l.n < 8) return `Noch zu wenig harte Einheiten mit Messwerten (${l?.n || 0} von 8), um deine Reaktion zu lernen.`;
  const parts = [];
  if (l.qMin != null) parts.push(`Harte Einheiten verkraftest du gut ab einer Bereitschaft von etwa ${l.qMin}${l.qMin < DEFAULT_Q_MIN ? " – tiefer als der Standard" : l.qMin > DEFAULT_Q_MIN ? " – höher als der Standard" : ""}`);
  if (l.recoveryDays != null) parts.push(`nach harten Tagen bist du im Schnitt nach ${l.recoveryDays.toFixed(1)} Tagen wieder auf dem Ausgangsniveau`);
  if (l.afterHard != null) parts.push(`am Folgetag ${l.afterHard >= 0 ? "+" : "−"}${Math.abs(Math.round(l.afterHard))} Punkte${l.afterEasy != null ? ` (nach lockeren Tagen ${l.afterEasy >= 0 ? "+" : "−"}${Math.abs(Math.round(l.afterEasy))})` : ""}`);
  return parts.length ? `${parts.join("; ")}. Gelernt aus ${l.n} harten Tagen.` : `Aus ${l.n} harten Tagen noch kein klares Muster.`;
}
