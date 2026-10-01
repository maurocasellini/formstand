// Kategorien und Trainingslast (TSS-ähnlich) für Workouts aller Quellen.

const STRENGTH = /weight|strength|crossfit|functional|hiit|workout|yoga|pilates|krafttraining|hyrox|powerlifting|calisthenics/i;
const DAILY = /^walk|^hike|walking|hiking|wandern|gehen|commute/i;

export function categorize(sport) {
  const s = String(sport || "");
  if (DAILY.test(s)) return "other";
  if (STRENGTH.test(s)) return "str";
  return "end";
}

// Schätzt die Last einer Einheit. Reihenfolge: Leistung (FTP) > Puls (Schwellenpuls) > Dauer.
export function estimateLoad({ duration_s, category, avg_power, np_power, avg_hr }, { ftp, lthr, maxHr } = {}) {
  const h = (duration_s || 0) / 3600;
  if (h <= 0) return 0;
  const p = np_power || avg_power;
  if (p && ftp) return Math.round(h * (p / ftp) ** 2 * 100);
  const thr = lthr || (maxHr ? maxHr * 0.88 : 168);
  if (avg_hr) return Math.round(h * (avg_hr / thr) ** 2 * 100 * (category === "str" ? 0.8 : 1));
  const perHour = category === "str" ? 45 : category === "other" ? 20 : 55;
  return Math.round(h * perHour);
}

const PRIORITY = { zwift: 5, garmin: 4, intervals: 4, strava: 3, whoop: 2, apple: 1, demo: 0 };

// Doppelte Workouts (gleiche Einheit aus mehreren Quellen) zusammenführen.
export function dedupe(acts) {
  const sorted = [...acts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const groups = [];
  for (const a of sorted) {
    const t = new Date(a.start_time).getTime();
    const g = groups.find((g) => {
      const p = g[0], tp = new Date(p.start_time).getTime();
      const durOk = Math.abs((p.duration_s || 0) - (a.duration_s || 0)) <= Math.max(600, 0.2 * Math.max(p.duration_s || 0, a.duration_s || 0));
      return Math.abs(tp - t) <= 10 * 60 * 1000 && durOk && p.provider !== a.provider;
    });
    if (g) g.push(a); else groups.push([a]);
  }
  return groups.map((g) => {
    const best = [...g].sort((x, y) => (y.has_power - x.has_power) || ((PRIORITY[y.provider] || 0) - (PRIORITY[x.provider] || 0)))[0];
    return { ...best, zt: best.zt || g.find((x) => x.zt)?.zt || null, sources: g.map((x) => x.provider), keys: g.map((x) => `${x.provider}|${x.external_id}`), duplicates: g.length - 1 };
  });
}

// Muskuläre Last nach Körperbereich: Minuten × gefühlte Anstrengung (1–10).
// Ohne Angabe wird die Anstrengung aus der Last pro Stunde geschätzt.
export function effortOf(a) {
  if (a.rpe) return a.rpe;
  if (a.category === "str") return 7;
  const h = (a.duration_s || 0) / 3600;
  return h > 0 ? Math.max(2, Math.min(9, Math.round(a.load / h / 12))) : 5;
}
export function muscleLoad(a) {
  const m = (a.duration_s || 0) / 60, e = effortOf(a), out = { legs: 0, upper: 0, core: 0 };
  if (a.category === "str") {
    const r = a.region || "full";
    if (r === "legs") { out.legs = m * e; out.core = m * e * 0.3; }
    else if (r === "upper") { out.upper = m * e; out.core = m * e * 0.3; }
    else { out.legs = m * e * 0.6; out.upper = m * e * 0.6; out.core = m * e * 0.5; }
  } else if (a.category === "end") {
    const s = String(a.sport || "");
    if (/run|lauf|trail/i.test(s)) { out.legs = m * e * 0.5; out.core = m * e * 0.1; }
    else if (/ride|bike|cycl|rad/i.test(s)) out.legs = m * e * 0.2;
    else if (/row|swim|ski/i.test(s)) { out.upper = m * e * 0.3; out.legs = m * e * 0.15; }
  }
  return out;
}
