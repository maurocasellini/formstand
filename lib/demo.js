import * as repo from "./repo";
import { addDays, todayIso } from "./metrics";

// Beispieldaten für ein Konto: 2 Jahre Workouts, Tageswerte, Trigger. Alle Zeilen is_demo=true.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());

export async function seedDemo(userId, kg = 80, { rich = false } = {}) {
  await clearDemo(userId);
  const r = rng(userId.split("").reduce((s, c) => s + c.charCodeAt(0), 7));
  const today = todayIso(), N = 730;
  const plan = [["Ride", 60], ["WeightTraining", 45], ["Run", 75], ["VirtualRide", 50], ["WeightTraining", 40], ["Ride", 120], ["Run", 90]];
  const acts = [], daily = [], manual = [], feel = {};
  let ctl = 40, atl = 40;
  for (let i = 0; i < N; i++) {
    const day = addDays(today, -(N - 1 - i)), dow = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7, t = i / N;
    const holiday = (i >= N - 96 && i < N - 83) || (i >= N - 461 && i < N - 448), ill = i >= N - 205 && i < N - 199;
    let [sport, base] = plan[dow];
    let load = base * (0.78 + 0.34 * t) * (Math.floor(i / 7) % 4 === 3 ? 0.65 : 1) * (0.85 + r() * 0.3);
    if (r() < 0.06 || ill) load = 0;
    if (holiday) load *= r() < 0.3 ? 0.6 : 0.1;
    if (load > 5) {
      const str = /Weight/.test(sport), dur = Math.round(load * (str ? 0.75 : 0.62) * 60);
      const hr = str ? 118 + r() * 15 : 128 + r() * 22;
      acts.push({ provider: rich ? "strava" : "demo", external_id: `d${i}`, start_time: `${day}T${dow >= 5 ? "08" : "18"}:00:00Z`, day, sport, category: str ? "str" : "end", name: str ? (rich ? ["Kraft Oberkörper", "Kraft Beine", "Kraft Ganzkörper"][i % 3] : "Kraft") : sport === "Run" ? (rich ? (base > 80 ? "Langer Lauf" : "Lauf am See") : "Lauf") : sport === "VirtualRide" ? (rich ? "Zwift – Watopia" : "Zwift") : (rich ? (base > 100 ? "Lange Ausfahrt" : "Feierabendrunde") : "Rad"),
        duration_s: dur, avg_hr: Math.round(hr), avg_power: /Ride/.test(sport) ? Math.round(150 + r() * 70) : null, has_power: /Ride/.test(sport), load: Math.round(load) });
    }
    if (rich && load > 5) {
      const str = /Weight/.test(sport), rpe = Math.max(2, Math.min(10, Math.round((str ? 7 : 3 + load / 25) + gauss(r) * 0.8)));
      if (r() < 0.85 || i > N - 3) feel[`strava|d${i}`] = { rpe, region: str ? ["full", "legs", "upper"][i % 3] : null, day, is_demo: true };
    }
    if (r() < 0.55) acts.push({ provider: rich ? "strava" : "demo", external_id: `w${i}`, start_time: `${day}T12:00:00Z`, day, sport: "Walk", category: "other", name: "Spaziergang", duration_s: Math.round((20 + r() * 40) * 60), has_power: false, load: Math.round(8 + r() * 10) });
    const prevDow = (dow + 6) % 7, alc = (prevDow === 4 || prevDow === 5) ? r() < (holiday ? 0.8 : 0.5) : r() < (holiday ? 0.4 : 0.07);
    const n = alc ? 1 + Math.floor(r() * 4) : 0;
    if (alc && i > 0) manual.push({ day: addDays(day, -1), kind: "trigger", value: n, data: { t: "alkohol" } });
    ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    const fatigue = (atl - ctl) / Math.max(ctl, 1), sleep = Math.max(4.8, Math.min(9.4, 7.4 + gauss(r) * 0.55 - (dow === 5 ? 0.5 : 0) - Math.max(0, fatigue) * 0.8 - (alc ? 0.35 : 0) + (holiday ? 0.4 : 0)));
    const hb = 62 * (0.9 + 0.14 * t), hrv = hb * (1 - fatigue * 0.22 + (sleep - 7.4) * 0.03 - (alc ? 0.03 * n + 0.02 : 0) - (ill ? 0.25 : 0)) + gauss(r) * hb * 0.06;
    const rhr = 50 * (1.04 - 0.05 * t + fatigue * 0.06 + (alc ? 0.02 : 0) + (ill ? 0.1 : 0)) + gauss(r) * 1.1;
    if (!rich) daily.push({ day, provider: "demo", hrv: Math.round(hrv * 10) / 10, rhr: Math.round(rhr * 10) / 10, sleep_h: Math.round(sleep * 100) / 100, steps: Math.round((holiday ? 11000 : 7000) + r() * 5000) });
    else {
      // Zwei Geräte wie im echten Leben: Garmin (mit allen Details) und WHOOP, leicht unterschiedlich gemessen
      const q = Math.max(0, Math.min(1, (sleep - 5) / 4)), deep = sleep * (0.17 + r() * 0.05), rem = sleep * (0.2 + r() * 0.05), awake = 0.2 + r() * 0.4 + (alc ? 0.3 : 0);
      const fresh = Math.max(0, Math.min(1, 0.55 - fatigue * 0.9 + (sleep - 7.4) * 0.12 - (alc ? 0.12 : 0) - (ill ? 0.4 : 0) + gauss(r) * 0.08));
      daily.push({ day, provider: "garmin", hrv: Math.round(hrv * 10) / 10, rhr: Math.round(rhr * 10) / 10, sleep_h: Math.round(sleep * 100) / 100, steps: Math.round((holiday ? 11000 : 7000) + r() * 5000),
        sleep_score: Math.round(45 + q * 45 + gauss(r) * 4 - (alc ? 6 : 0)), deep_h: Math.round(deep * 100) / 100, rem_h: Math.round(rem * 100) / 100, awake_h: Math.round(awake * 100) / 100, light_h: Math.round((sleep - deep - rem) * 100) / 100,
        avg_sleep_hr: Math.round(rhr + 3 + (alc ? 4 : 0)), bb_high: Math.round(35 + fresh * 60), bb_low: Math.round(5 + r() * 20), stress_avg: Math.round(22 + (1 - fresh) * 25 + r() * 8),
        spo2: Math.round(94 + r() * 4), respiration: Math.round((13.5 + r() * 2 + (alc ? 0.8 : 0)) * 10) / 10, readiness: Math.round(15 + fresh * 80), vo2max: Math.round((52 + 4 * t + gauss(r) * 0.3) * 10) / 10,
        skin_temp: Math.round((gauss(r) * 0.2 + (alc ? 0.3 : 0) + (ill ? 0.9 : 0)) * 10) / 10, intensity_min: Math.round(load > 5 ? 20 + load * 0.5 : r() * 15) });
      daily.push({ day, provider: "whoop", hrv: Math.round(hrv * (1.12 + gauss(r) * 0.03) * 10) / 10, rhr: Math.round((rhr - 1 + gauss(r) * 0.6) * 10) / 10, sleep_h: Math.round((sleep - 0.15 + gauss(r) * 0.12) * 100) / 100,
        recovery_score: Math.round(Math.max(3, Math.min(99, 20 + fresh * 80))), strain: Math.round(Math.min(21, 4 + load * 0.09 + r() * 2) * 10) / 10 });
    }
    if (rich && (r() < 0.7 || i === N - 1)) {
      const f = Math.max(-1, Math.min(1, fatigue * 2 + (alc ? 0.4 : 0) - (sleep - 7.4) * 0.4)), c5 = (v) => Math.max(1, Math.min(5, Math.round(v)));
      const legsHit = acts.filter((a) => a.day >= addDays(day, -2) && a.category !== "other" && /Weight|Run/.test(a.sport)).length;
      manual.push({ day, kind: "checkin", value: null, data: { energy: c5(3.4 - f * 1.5 + gauss(r) * 0.6), motivation: c5(3.6 - f + gauss(r) * 0.7), stress: c5(2.4 + (dow < 5 ? 0.5 : -0.4) + gauss(r) * 0.7),
        soreness: { legs: Math.min(3, Math.max(0, Math.round(legsHit * 0.7 + gauss(r) * 0.4))), upper: Math.max(0, Math.min(3, Math.round(r() * 1.4))), core: Math.max(0, Math.min(2, Math.round(r()))) }, time_min: [45, 60, 60, 90, 60, 120, 90][dow] } });
    }
    if (i % 3 === 0) manual.push({ day, kind: "weight", value: Math.round((kg + 3.4 - 3.3 * t + Math.sin(i / 40) * 0.5 + gauss(r) * 0.4) * 10) / 10, data: {} });
  }
  manual.push({ day: addDays(today, -42), kind: "test", value: 248, data: { test: "ramp", note: "Beispiel" } });
  if (rich) {
    manual.push({ day: addDays(today, -210), kind: "test", value: 229, data: { test: "ramp", note: "Zwift Ramp Test" } });
    manual.push({ day: addDays(today, -126), kind: "test", value: 238, data: { test: "twenty", note: "Alpe du Zwift" } });
    manual.push({ day: addDays(today, -95), kind: "test", value: 171, data: { test: "labor", note: "Laktat 4 mmol bei 262 W" } });
    manual.push({ day: addDays(today, -14), kind: "test", value: 55.4, data: { test: "vo2", note: "Garmin" } });
    for (let i = 3; i < N; i += 11 + Math.floor(r() * 9)) manual.push({ day: addDays(today, -i), kind: "trigger", value: 1, data: { t: ["spaet", "stress", "koffein", "reise", "screen"][Math.floor(r() * 5)] } });
    // InBody alle ~2 Monate: Fett runter, Muskeln leicht hoch
    for (let k = 0; k < 6; k++) {
      const day = addDays(today, -(10 + k * 60)), f = k / 5, w = Math.round((kg + 0.4 + 2.6 * f) * 10) / 10, pct = Math.round((13.2 + 3.4 * f) * 10) / 10, smm = Math.round((38.6 - 1.1 * f) * 10) / 10;
      const fm = Math.round(w * pct) / 100, data = { weight_kg: w, smm_kg: smm, fat_mass_kg: Math.round(fm * 10) / 10, body_fat_pct: pct, ffm_kg: Math.round((w - fm) * 10) / 10, tbw_l: Math.round((w - fm) * 0.733 * 10) / 10,
        protein_kg: Math.round((w - fm) * 0.197 * 10) / 10, minerals_kg: Math.round((w - fm) * 0.068 * 10) / 10, bmi: Math.round((w / 1.82 ** 2) * 10) / 10, visceral_level: Math.round(6 - 2 * (1 - f)), bmr_kcal: Math.round(370 + 21.6 * (w - fm)),
        ecw_ratio: 0.379, inbody_score: Math.round(87 - 6 * f), phase_angle: Math.round((6.9 - 0.3 * f) * 10) / 10, device: "InBody 570" };
      manual.push({ day, kind: "inbody", value: data.inbody_score, data, source_media: "demo" });
      manual.push({ day, kind: "bodyfat", value: pct, data: {}, source_media: "demo" });
    }
  }
  manual.push({ day: addDays(today, -21), kind: "test", value: 166, data: { test: "garmin_lt", note: "Beispiel" } });

  await repo.upsertActivities(userId, acts.map((a) => ({ ...a, is_demo: true })));
  await repo.upsertDaily(userId, daily.map((d) => ({ ...d, is_demo: true })));
  await repo.addManualMany(userId, manual.map((m) => ({ ...m, is_demo: true })));
  if (rich) await repo.write(`u/${userId}/feel.json`, feel);
  return acts.length + daily.length + manual.length;
}

export async function clearDemo(userId) {
  await repo.clearDemoData(userId);
}

// Beispiel-Empfehlung für das Demo-Konto (ohne KI-Aufruf)
export function demoAdvice(day, score) {
  const st = score == null ? "warn" : score >= 67 ? "good" : score >= 34 ? "warn" : "crit";
  const t = {
    good: ["Grünes Licht für Intervalle", "Deine HRV liegt über der Baseline, der Schlaf war solide und die Form ist positiv. Ideal für einen harten Reiz.", "Rad: 15 min einfahren, dann 4×8 min bei 262–275 W (Schwelle) mit 4 min locker, 10 min ausfahren. Gesamt 75 min.", "Lauf: 3×10 min bei 160–166 bpm mit 3 min Trabpause.", "Nach der Einheit innert 30 min Kohlenhydrate und 30 g Protein. 7,5 h Schlaf anpeilen."],
    warn: ["Locker bleiben, Grundlage sammeln", "HRV leicht unter deiner Baseline, Schlaf knapp unter Schnitt. Die Belastung der letzten Tage ist noch spürbar.", "Rad: 75 min Zone 2 bei 150–185 W, Kadenz 90+, flach. Kein Intervall.", "40 min lockerer Lauf unter 145 bpm oder 30 min Mobility.", "Heute 30 min früher ins Bett. Kein Alkohol, damit die HRV morgen zurückkommt."],
    crit: ["Heute Erholung priorisieren", "HRV deutlich unter Baseline, Ruhepuls erhöht. Dein Körper braucht Erholung, Training bringt heute wenig.", "Ruhetag. Optional 30 min Spaziergang oder lockeres Ausrollen unter 135 W.", "15 min Mobility und Dehnen.", "Viel trinken (2,5 l), proteinreich essen, 8+ h Schlaf. Bei Krankheitsgefühl ganz pausieren."],
  }[st];
  return { headline: t[0], state: st, summary: t[1], training: t[2], alternative: t[3], recovery: t[4],
    nutrition: "Rund 1,6 g Protein pro kg Körpergewicht, Kohlenhydrate an die Trainingsmenge anpassen.",
    watch: ["Am Wochenende wirkt Alkohol bei dir besonders stark auf die HRV."],
    why: ["Tagesform " + (score ?? "–") + "/100", "HRV und Ruhepuls im Vergleich zu deinen letzten 28 Tagen", "Trainingslast der letzten 7 Tage im Verhältnis zur Fitness"],
    model: "Beispiel", day, created_at: new Date().toISOString(), score };
}
