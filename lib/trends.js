// Trends im Detail: je Kennzahl Verlauf (Tageswerte + 7-Tage-Schnitt), Normalbereich, Kennzahlen und regelbasierte Einordnung.
// Zeiträume 4 Wochen / 3 Monate / 12 Monate. Die KI-Erklärung dazu entsteht mit dem Wochenbrief (montags).
const mean = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const sd = (a) => { const x = a.filter((v) => v != null), m = mean(x); return x.length > 2 ? Math.sqrt(mean(x.map((v) => (v - m) ** 2))) : null; };

export const RANGES = [["4w", "4 Wochen", 28], ["3m", "3 Monate", 91], ["12m", "12 Monate", 365]];
// [Schlüssel, Name, Einheit, Richtung (+1 höher besser, −1 tiefer besser, 0 neutral), Nachkommastellen, Gruppe, Erklärung]
export const METRICS = [
  ["hrv", "HRV", "ms", 1, 0, "Erholung", "Herzratenvariabilität in der Nacht – höher heisst meist besser erholt. Zählt der Trend, nicht der einzelne Tag."],
  ["rhr", "Ruhepuls", "bpm", -1, 0, "Erholung", "Steigt bei Ermüdung, Stress oder Infekt, sinkt mit besserer Grundform."],
  ["sleep", "Schlaf", "h", 1, 1, "Erholung", "Schlafdauer laut Uhr. Unter deinem Schnitt leidet meist die HRV am Morgen danach."],
  ["score", "Bereitschaft", "", 1, 0, "Erholung", "Formstand-Wert 0–100 aus HRV, Ruhepuls, Schlaf, Form und Check-in."],
  ["kcalEaten", "Kalorien gegessen", "kcal", 0, 0, "Ernährung", "Aus MyFitnessPal/Cronometer oder Garmin. Im Vergleich zum Tagesziel in der Entscheidung für heute."],
  ["proteinEaten", "Protein", "g", 0, 0, "Ernährung", "Für Sportler meist 1,6–2,2 g pro kg Körpergewicht."],
  ["vo2max", "VO2max", "ml/kg/min", 1, 1, "Leistung & Körper", "Schätzung der Uhr für die maximale Sauerstoffaufnahme – bewegt sich langsam."],
  ["weight", "Gewicht", "kg", 0, 1, "Leistung & Körper", "Tageswerte schwanken um ±1 kg; aussagekräftig ist der 7-Tage-Schnitt."],
];

// gleitender Schnitt über die letzten k vorhandenen Tage (Lücken bleiben Lücken)
function rolling(vals, k = 7) {
  return vals.map((_, i) => { const w = vals.slice(Math.max(0, i - k + 1), i + 1).filter((v) => v != null); return w.length >= Math.min(3, k) ? mean(w) : null; });
}

function metricRange(all, [k, label, unit, dir, dec], days) {
  const sl = all.slice(-days), vals = sl.map((d) => (d[k] == null ? null : Number(d[k])));
  const have = vals.filter((v) => v != null);
  if (have.length < Math.min(8, days / 4)) return null;
  // Lückenhafte Reihen (z. B. Gewicht): Schnitt der letzten 3 Messungen, Linie über die Lücken
  const sparse = have.length < sl.length * 0.5;
  const roll = sparse ? vals.map((v, i) => (v == null ? null : mean(vals.slice(0, i + 1).filter((z) => z != null).slice(-3)))) : rolling(vals, 7);
  const m = mean(have), s = sd(have);
  const firstAvg = mean(roll.slice(0, Math.ceil(days / 6)).filter((v) => v != null)), lastAvg = sparse ? [...roll].reverse().find((v) => v != null) : mean(roll.slice(-7).filter((v) => v != null));
  const change = firstAvg != null && lastAvg != null ? lastAvg - firstAvg : null;
  const cur = [...vals].reverse().find((v) => v != null);
  const bestV = dir === 0 ? null : dir > 0 ? Math.max(...have) : Math.min(...have);
  const bestDay = bestV == null ? null : sl[vals.indexOf(bestV)]?.day;
  // Einordnung: Veränderung im Verhältnis zur Streuung
  const rel = change != null && s ? change / s : 0;
  const pct = change != null && firstAvg ? (change / firstAvg) * 100 : null;
  let trend = "stabil", tone = "";
  if (Math.abs(rel) >= 0.5 && (k !== "vo2max" || Math.abs(change) >= 0.8) && (k !== "weight" || Math.abs(change) >= 0.5)) {
    trend = change > 0 ? "steigt" : "sinkt";
    tone = dir === 0 ? "" : dir * change > 0 ? "good" : "warn";
  }
  const f = (v) => (v == null ? "–" : v.toFixed(dec));
  const delta = change == null ? null : k === "hrv" && pct != null ? `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)} %` : k === "sleep" ? `${change > 0 ? "+" : "−"}${Math.abs(change * 60).toFixed(0)} min` : `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(dec)} ${unit}`.trim();
  return {
    days: sl.map((d) => d.day), vals, roll, sparse, m, s, cur, avg7: lastAvg, change, delta, trend, tone,
    best: bestV != null ? { v: bestV, day: bestDay } : null, min: Math.min(...have), max: Math.max(...have), n: have.length,
    text: `${trend === "stabil" ? "Stabil" : trend === "steigt" ? "Steigt" : "Sinkt"}${delta ? ` (${delta} über den Zeitraum, 7-Tage-Schnitt)` : ""} · Ø ${f(m)} ${unit}`.trim(),
    fmt: f,
  };
}

// Training: Fitness (CTL), Ermüdung (ATL), Form (TSB) und Wochenstunden Ausdauer/Kraft
function trainingRange(all, days) {
  const sl = all.slice(-days);
  if (!sl.some((d) => d.ctl)) return null;
  const weeks = [];
  for (let e = all.length - 1; e > all.length - 1 - days; e -= 7) {
    const w = all.slice(Math.max(0, e - 6), e + 1);
    const endMin = w.reduce((s, d) => s + (d.smin || 0), 0), strDays = w.filter((d) => d.str > 0);
    // Stunden je Kategorie aus der Last-Verteilung des Tages geschätzt
    const strH = w.reduce((s, d) => s + (d.str > 0 && d.load > 0 ? ((d.smin || 0) * d.str) / d.load : 0), 0) / 60;
    weeks.unshift({ from: w[0]?.day, to: w.at(-1)?.day, hours: endMin / 60, strH: Math.min(strH, endMin / 60), endH: Math.max(0, endMin / 60 - strH), sessions: w.reduce((s, d) => s + (d.sessions || 0), 0), strDays: strDays.length });
  }
  const ctl0 = sl[0].ctl, ctl1 = sl.at(-1).ctl;
  const avgH = mean(weeks.slice(0, -1).map((w) => w.hours));
  return {
    days: sl.map((d) => d.day), ctl: sl.map((d) => d.ctl), atl: sl.map((d) => d.atl), tsb: sl.map((d) => d.tsb), weeks,
    ctlNow: ctl1, ctlChange: ctl1 - ctl0, tsbNow: sl.at(-1).tsb, avgHours: avgH,
    text: `Fitness ${ctl1 - ctl0 >= 0 ? "+" : "−"}${Math.abs(ctl1 - ctl0).toFixed(0)} auf ${Math.round(ctl1)} · Form ${Math.round(sl.at(-1).tsb)} · Ø ${avgH != null ? avgH.toFixed(1) : "–"} h pro Woche`,
  };
}

export function trendDetails(all) {
  const out = {};
  for (const [key, label, days] of RANGES) {
    if (all.length < Math.min(days, 40)) continue;
    const metrics = METRICS.map((d) => { const r = metricRange(all, d, days); return r ? { key: d[0], label: d[1], unit: d[2], dir: d[3], dec: d[4], group: d[5], about: d[6], ...r } : null; }).filter(Boolean);
    out[key] = { key, label, days, metrics, training: trainingRange(all, days) };
  }
  return out;
}

// Kompakt für die KI (Wochenbrief): Zahlen pro Kennzahl und Zeitraum
export const trendsBrief = (td) => Object.fromEntries(Object.values(td).map((R) => [R.label, {
  ...Object.fromEntries(R.metrics.map((x) => [x.label, { aktuell: x.cur != null ? Number(x.cur.toFixed(x.dec)) : null, schnitt_7_tage: x.avg7 != null ? Number(x.avg7.toFixed(x.dec)) : null, schnitt_zeitraum: Number(x.m.toFixed(x.dec)), veraenderung: x.delta, trend: x.trend, bestwert: x.best ? `${x.best.v.toFixed(x.dec)} am ${x.best.day}` : null }])),
  training: R.training ? { fitness_ctl: Math.round(R.training.ctlNow), fitness_veraenderung: Math.round(R.training.ctlChange), form_tsb: Math.round(R.training.tsbNow), stunden_pro_woche: R.training.weeks.map((w) => Number(w.hours.toFixed(1))) } : null,
}]));
