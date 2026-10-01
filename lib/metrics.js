import { q } from "./db";
import { dedupe } from "./load";
import { athleteZones } from "./sync";

export const isoDay = (d) => { const x = new Date(d); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`; };
export const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); };
export const todayIso = () => isoDay(new Date(Date.now() + 2 * 3600e3)); // CH-Zeit grob
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) || 1; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (v == null ? null : Number(v));

export async function buildSeries(userId, from, to) {
  const warm = addDays(from, -120);
  const [acts, dm, man, zones] = await Promise.all([
    q(`select provider, external_id, start_time, day::text as day, sport, category, name, duration_s, distance_m, avg_hr, avg_power, np_power, kcal, has_power, load
         from activities where user_id=$1 and day between $2 and $3 order by start_time`, [userId, warm, to]),
    q(`select day::text as day, provider, recovery_score, hrv, rhr, sleep_h, strain, steps from daily_metrics where user_id=$1 and day between $2 and $3`, [userId, warm, to]),
    q(`select id, day::text as day, kind, value, unit, data from manual_entries where user_id=$1 and day between $2 and $3 order by day`, [userId, warm, to]),
    athleteZones(userId),
  ]);

  const merged = dedupe(acts.map((a) => ({ ...a, duration_s: Number(a.duration_s), load: Number(a.load), has_power: Boolean(a.has_power) })));
  const days = [];
  const idx = new Map();
  for (let d = warm; d <= to; d = addDays(d, 1)) {
    const o = { day: d, end: 0, str: 0, other: 0, load: 0, min: 0, n: 0, low: 0, mid: 0, high: 0, prov: {}, triggers: [], weight: null, bodyfat: null };
    idx.set(d, o); days.push(o);
  }
  const lthr = zones.lthr || null;
  for (const a of merged) {
    const o = idx.get(a.day); if (!o) continue;
    o[a.category] += a.load; o.load += a.category === "other" ? 0 : a.load; o.min += Math.round(a.duration_s / 60);
    if (a.category !== "other") o.n++;
    if (a.category === "end") {
      const m = a.duration_s / 60, hr = num(a.avg_hr), ref = lthr || 168;
      if (!hr) o.low += m; else if (hr < ref * 0.85) o.low += m; else if (hr < ref * 0.95) o.mid += m; else o.high += m;
    }
  }
  for (const r of dm) { const o = idx.get(r.day); if (o) o.prov[r.provider] = { recovery: num(r.recovery_score), hrv: num(r.hrv), rhr: num(r.rhr), sleep: num(r.sleep_h), strain: num(r.strain), steps: num(r.steps) }; }
  for (const m of man) {
    const o = idx.get(m.day); if (!o) continue;
    if (m.kind === "weight") o.weight = num(m.value);
    if (m.kind === "bodyfat") o.bodyfat = num(m.value);
    if (m.kind === "trigger") o.triggers.push({ t: m.data?.t, n: num(m.value), id: m.id });
  }

  // Fitness / Ermüdung / Form
  let ctl = 0, atl = 0;
  for (const o of days) { o.tsb = ctl - atl; ctl += (o.load - ctl) / 42; atl += (o.load - atl) / 7; o.ctl = ctl; o.atl = atl; }

  // Tagesform: je Quelle gegen eigene 28-Tage-Baseline normieren, dann kombinieren
  const providers = [...new Set(dm.map((r) => r.provider))];
  for (let i = 0; i < days.length; i++) {
    const o = days[i], zs = { hrv: [], rhr: [], sleep: [] };
    for (const p of providers) {
      const cur = o.prov[p]; if (!cur) continue;
      const win = days.slice(Math.max(0, i - 28), i).map((x) => x.prov[p]).filter(Boolean);
      for (const k of ["hrv", "rhr", "sleep"]) {
        const vals = win.map((w) => w[k]).filter((v) => v != null);
        if (cur[k] == null || vals.length < 7) continue;
        const v = k === "hrv" ? Math.log(cur[k]) : cur[k], base = k === "hrv" ? vals.map(Math.log) : vals;
        zs[k].push((v - mean(base)) / sd(base));
      }
    }
    const zH = mean(zs.hrv), zR = mean(zs.rhr), zS = mean(zs.sleep), zT = clamp(o.tsb / 15, -2, 2);
    const vals = Object.values(o.prov);
    o.hrv = mean(vals.map((v) => v.hrv).filter((v) => v != null));
    o.rhr = mean(vals.map((v) => v.rhr).filter((v) => v != null));
    o.sleep = mean(vals.map((v) => v.sleep).filter((v) => v != null));
    o.steps = mean(vals.map((v) => v.steps).filter((v) => v != null));
    if (zH == null && zR == null && zS == null) { o.score = null; continue; }
    o.z = { hrv: zH ?? 0, rhr: zR == null ? 0 : -zR, sleep: zS ?? 0, tsb: zT };
    o.score = Math.round(clamp(55 + (0.45 * (zH ?? 0) - 0.25 * (zR ?? 0) + 0.2 * (zS ?? 0) + 0.1 * zT) * 22, 1, 99));
  }
  // Trigger wirken auf den nächsten Morgen
  for (let i = 1; i < days.length; i++) days[i].night = days[i - 1].triggers;
  if (days.length) days[0].night = [];

  const inRange = days.filter((d) => d.day >= from);
  const activities = merged.filter((a) => a.day >= from).reverse();
  return { days: inRange, all: days, activities, providers, zones };
}

export const stateOf = (s) => (s == null ? "none" : s >= 67 ? "good" : s >= 34 ? "warn" : "crit");
export const stateText = (s) => (s == null ? "Noch keine Daten" : s >= 67 ? "Bereit für Intensität" : s >= 34 ? "Moderat belasten" : "Erholung priorisieren");
