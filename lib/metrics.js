import * as repo from "./repo";
import { dedupe, muscleLoad } from "./load";
import { athleteZones } from "./sync";

// Zusatzwerte (v. a. Garmin): Spalte → Feldname im Tagesobjekt
export const EXTRA = { sleep_score: "sleepScore", deep_h: "deep", light_h: "light", rem_h: "rem", awake_h: "awake", avg_sleep_hr: "sleepHr", bb_high: "bbHigh", bb_low: "bbLow", stress_avg: "stress", spo2: "spo2", respiration: "resp", readiness: "readiness", vo2max: "vo2max", skin_temp: "skinTemp", intensity_min: "intensity" };

export const isoDay = (d) => { const x = new Date(d); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`; };
export const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); };
export const todayIso = () => isoDay(new Date(Date.now() + 2 * 3600e3)); // CH-Zeit grob
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) || 1; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (v == null ? null : Number(v));

export async function buildSeries(userId, from, to) {
  const warm = addDays(from, -120);
  const [allActs, allDaily, allMan, feel] = await Promise.all([repo.getActivities(userId), repo.getDaily(userId), repo.getManual(userId), repo.getFeel(userId)]);
  const inWin = (d) => d >= warm && d <= to;
  const acts = allActs.filter((a) => inWin(a.day));
  const dm = allDaily.filter((r) => inWin(r.day));
  const man = allMan.filter((m) => inWin(m.day)).sort((a, b) => (a.day < b.day ? -1 : 1));
  const zones = await athleteZones(userId, allMan);

  const merged = dedupe(acts.map((a) => ({ ...a, duration_s: Number(a.duration_s), load: Number(a.load), has_power: Boolean(a.has_power) })));
  for (const a of merged) {
    const f = a.keys.map((k) => feel[k]).find(Boolean);
    if (f) { a.rpe = f.rpe || null; a.region = f.region || null; }
    a.feelKey = a.keys[0];
  }
  const days = [];
  const idx = new Map();
  for (let d = warm; d <= to; d = addDays(d, 1)) {
    const o = { day: d, end: 0, str: 0, other: 0, load: 0, min: 0, n: 0, low: 0, mid: 0, high: 0, prov: {}, triggers: [], weight: null, bodyfat: null, mus: { legs: 0, upper: 0, core: 0 }, rated: 0, sessions: 0, smin: 0, checkin: null };
    idx.set(d, o); days.push(o);
  }
  const lthr = zones.lthr || null;
  for (const a of merged) {
    const o = idx.get(a.day); if (!o) continue;
    o[a.category] += a.load; o.load += a.category === "other" ? 0 : a.load; o.min += Math.round(a.duration_s / 60);
    if (a.category !== "other") { o.n++; o.sessions++; o.smin += Math.round(a.duration_s / 60); if (a.rpe) o.rated++; }
    const ml = muscleLoad(a); o.mus.legs += ml.legs; o.mus.upper += ml.upper; o.mus.core += ml.core;
    if (a.category !== "other" && (a.rpe >= 7 || a.load / Math.max(0.25, a.duration_s / 3600) > 85)) (o.hardSessions ||= []).push({ day: a.day, name: a.name || a.sport, category: a.category, region: a.region || null });
    if (a.category === "end") {
      const m = a.duration_s / 60, hr = num(a.avg_hr), ref = lthr || 168;
      if (!hr) o.low += m; else if (hr < ref * 0.85) o.low += m; else if (hr < ref * 0.95) o.mid += m; else o.high += m;
    }
  }
  for (const r of dm) {
    const o = idx.get(r.day); if (!o) continue;
    const pv = { recovery: num(r.recovery_score), hrv: num(r.hrv), rhr: num(r.rhr), sleep: num(r.sleep_h), strain: num(r.strain), steps: num(r.steps), weight: num(r.weight) };
    for (const [col, key] of Object.entries(EXTRA)) pv[key] = num(r[col]);
    o.prov[r.provider] = pv;
  }
  for (const m of man) {
    const o = idx.get(m.day); if (!o) continue;
    if (m.kind === "weight") o.weight = num(m.value);
    if (m.kind === "bodyfat") o.bodyfat = num(m.value);
    if (m.kind === "trigger") o.triggers.push({ t: m.data?.t, n: num(m.value), id: m.id });
    if (m.kind === "checkin") o.checkin = m.data;
  }

  // Fitness / Ermüdung / Form
  let ctl = 0, atl = 0, ctlE = 0, atlE = 0;
  for (const o of days) {
    o.tsb = ctl - atl; ctl += (o.load - ctl) / 42; atl += (o.load - atl) / 7; o.ctl = ctl; o.atl = atl;
    ctlE += (o.end - ctlE) / 28; atlE += (o.end - atlE) / 7; o.ctlE = ctlE; o.atlE = atlE;
  }

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
    for (const key of Object.values(EXTRA)) o[key] = mean(vals.map((v) => v[key]).filter((v) => v != null));
    if (o.weight == null) o.weight = mean(vals.map((v) => v.weight).filter((v) => v != null));
    const subj = subjective(o.checkin);
    if (zH == null && zR == null && zS == null) { o.score = subj == null ? null : Math.round(subj); o.scoreObj = null; continue; }
    o.z = { hrv: zH ?? 0, rhr: zR == null ? 0 : -zR, sleep: zS ?? 0, tsb: zT };
    o.scoreObj = Math.round(clamp(55 + (0.45 * (zH ?? 0) - 0.25 * (zR ?? 0) + 0.2 * (zS ?? 0) + 0.1 * zT) * 22, 1, 99));
    // Subjektives Befinden fliesst zu einem Viertel ein, wenn ein Check-in vorliegt
    o.score = subj == null ? o.scoreObj : Math.round(0.75 * o.scoreObj + 0.25 * subj);
  }
  // Trigger wirken auf den nächsten Morgen
  for (let i = 1; i < days.length; i++) days[i].night = days[i - 1].triggers;
  if (days.length) days[0].night = [];

  const inRange = days.filter((d) => d.day >= from);
  const activities = merged.filter((a) => a.day >= from).reverse();
  return { days: inRange, all: days, activities, providers, zones };
}

// Check-in → 0–100 (Energie, Motivation, Stress invertiert, stärkster Muskelkater invertiert)
export function subjective(c) {
  if (!c) return null;
  const p = [];
  if (c.energy) p.push(((c.energy - 1) / 4) * 100);
  if (c.motivation) p.push(((c.motivation - 1) / 4) * 100);
  if (c.stress) p.push(((5 - c.stress) / 4) * 100);
  const sore = Math.max(...["legs", "upper", "core"].map((k) => Number(c.soreness?.[k] ?? -1)));
  if (sore >= 0) p.push(((3 - sore) / 3) * 100);
  return p.length ? mean(p) : null;
}

export const stateOf = (s) => (s == null ? "none" : s >= 67 ? "good" : s >= 34 ? "warn" : "crit");
export const stateText = (s) => (s == null ? "Noch keine Daten" : s >= 67 ? "Bereit für Intensität" : s >= 34 ? "Moderat belasten" : "Erholung priorisieren");
