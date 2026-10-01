// Körperziel: Trend aus den Gewichtswerten (lineare Regression, 28 Tage), Ankunft, Warnungen.
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export function bodyProgress(all, manual, goals) {
  const pts = all.slice(-28).map((d, i) => [i, d.weight]).filter(([, w]) => w != null);
  const now = mean(all.slice(-7).map((d) => d.weight).filter((w) => w != null)) ?? mean(pts.map((p) => p[1]));
  let slope = null;
  if (pts.length >= 8) {
    const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
    slope = (pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / pts.reduce((s, [x]) => s + (x - mx) ** 2, 0)) * 7; // kg pro Woche
  }
  const bf = manual.filter((m) => m.kind === "bodyfat").sort((a, b) => (a.day < b.day ? -1 : 1));
  const bfNow = bf.length ? Number(bf[bf.length - 1].value) : null;
  const t = Number(goals.targetWeight) || null, tb = Number(goals.targetBodyfat) || null;
  const out = { now: now != null ? Math.round(now * 10) / 10 : null, slope: slope != null ? Math.round(slope * 100) / 100 : null, target: t, bfNow, bfTarget: tb, warnings: [], eta: null };
  if (now == null) return out;
  const pct = slope != null ? (slope / now) * 100 : null;
  out.pct = pct != null ? Math.round(pct * 100) / 100 : null;
  if (t && slope && Math.sign(t - now) === Math.sign(slope) && Math.abs(slope) > 0.02) {
    const weeks = (t - now) / slope;
    if (weeks > 0 && weeks < 104) { const d = new Date(); d.setUTCDate(d.getUTCDate() + Math.round(weeks * 7)); out.eta = d.toISOString().slice(0, 10); out.weeks = Math.round(weeks); }
  }
  if (goals.focus === "cut") {
    if (pct != null && pct < -1) out.warnings.push(`Du verlierst ${Math.abs(pct).toFixed(1)} % pro Woche – zu schnell, Muskeln und Leistung leiden. Ziel: 0,25–0,75 %.`);
    if (pct != null && pct > 0.15) out.warnings.push("Gewicht steigt statt sinkt. Energiebilanz an lockeren Tagen prüfen.");
    if (t && now <= t) out.warnings.push("Zielgewicht erreicht – jetzt auf „Form halten“ umstellen.");
  }
  if (goals.focus === "muscle" && pct != null && pct > 0.5) out.warnings.push(`Zunahme ${pct.toFixed(1)} % pro Woche – eher zu schnell, der Rest ist meist Fett. Ziel: 0,25–0,5 %.`);
  return out;
}
