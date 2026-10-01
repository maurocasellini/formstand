// Belastung getrennt statt einer einzigen Zahl: Herz-Kreislauf (Ausdauerlast), Muskulär je Bereich, Volumen.
// Jeweils letzte 7 Tage gegen deinen Wochenschnitt der 4 Wochen davor (Verhältnis 1.0 = wie üblich).
const sum = (a) => a.reduce((s, v) => s + v, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);

export function loadSplit(all, i = all.length - 1) {
  if (i < 14) return null;
  const week = (end, f) => sum(all.slice(Math.max(0, end - 6), end + 1).map(f));
  const prior = (f) => { const w = [1, 2, 3, 4].map((k) => (i - 7 * k >= 6 ? week(i - 7 * k, f) : null)).filter((v) => v != null); return w.length >= 2 ? mean(w) : null; };
  const one = (f) => { const w7 = week(i, f), avg = prior(f); return { w7, avg, ratio: avg ? w7 / avg : null }; };
  return {
    cardio: one((d) => d.end || 0),
    muscle: { legs: one((d) => d.mus?.legs || 0), upper: one((d) => d.mus?.upper || 0), core: one((d) => d.mus?.core || 0) },
    hours: one((d) => (d.smin || 0) / 60),
  };
}

// Einordnung eines Verhältnisses in Worte
export const ratioWord = (r) => (r == null ? "–" : r < 0.7 ? "deutlich weniger" : r < 0.9 ? "etwas weniger" : r <= 1.15 ? "wie üblich" : r <= 1.4 ? "etwas mehr" : "deutlich mehr");
