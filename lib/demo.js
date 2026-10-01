import { q } from "./db";
import { addDays, todayIso } from "./metrics";

// Beispieldaten für ein Konto: 2 Jahre Workouts, Tageswerte, Trigger. Alle Zeilen is_demo=true.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());

export async function seedDemo(userId, kg = 80) {
  await clearDemo(userId);
  const r = rng(userId.split("").reduce((s, c) => s + c.charCodeAt(0), 7));
  const today = todayIso(), N = 730;
  const plan = [["Ride", 60], ["WeightTraining", 45], ["Run", 75], ["VirtualRide", 50], ["WeightTraining", 40], ["Ride", 120], ["Run", 90]];
  const acts = [], daily = [], manual = [];
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
      acts.push({ provider: "demo", external_id: `d${i}`, start_time: `${day}T${dow >= 5 ? "08" : "18"}:00:00Z`, day, sport, category: str ? "str" : "end", name: str ? "Kraft" : sport === "Run" ? "Lauf" : sport === "VirtualRide" ? "Zwift" : "Rad",
        duration_s: dur, avg_hr: Math.round(hr), avg_power: /Ride/.test(sport) ? Math.round(150 + r() * 70) : null, has_power: /Ride/.test(sport), load: Math.round(load) });
    }
    if (r() < 0.55) acts.push({ provider: "demo", external_id: `w${i}`, start_time: `${day}T12:00:00Z`, day, sport: "Walk", category: "other", name: "Spaziergang", duration_s: Math.round((20 + r() * 40) * 60), has_power: false, load: Math.round(8 + r() * 10) });
    const prevDow = (dow + 6) % 7, alc = (prevDow === 4 || prevDow === 5) ? r() < (holiday ? 0.8 : 0.5) : r() < (holiday ? 0.4 : 0.07);
    const n = alc ? 1 + Math.floor(r() * 4) : 0;
    if (alc && i > 0) manual.push({ day: addDays(day, -1), kind: "trigger", value: n, data: { t: "alkohol" } });
    ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    const fatigue = (atl - ctl) / Math.max(ctl, 1), sleep = Math.max(4.8, Math.min(9.4, 7.4 + gauss(r) * 0.55 - (dow === 5 ? 0.5 : 0) - Math.max(0, fatigue) * 0.8 - (alc ? 0.35 : 0) + (holiday ? 0.4 : 0)));
    const hb = 62 * (0.9 + 0.14 * t), hrv = hb * (1 - fatigue * 0.22 + (sleep - 7.4) * 0.03 - (alc ? 0.03 * n + 0.02 : 0) - (ill ? 0.25 : 0)) + gauss(r) * hb * 0.06;
    const rhr = 50 * (1.04 - 0.05 * t + fatigue * 0.06 + (alc ? 0.02 : 0) + (ill ? 0.1 : 0)) + gauss(r) * 1.1;
    daily.push({ day, provider: "demo", hrv: Math.round(hrv * 10) / 10, rhr: Math.round(rhr * 10) / 10, sleep_h: Math.round(sleep * 100) / 100, steps: Math.round((holiday ? 11000 : 7000) + r() * 5000) });
    if (i % 3 === 0) manual.push({ day, kind: "weight", value: Math.round((kg + 3.4 - 3.3 * t + Math.sin(i / 40) * 0.5 + gauss(r) * 0.4) * 10) / 10, data: {} });
  }
  manual.push({ day: addDays(today, -42), kind: "test", value: 248, data: { test: "ramp", note: "Beispiel" } });
  manual.push({ day: addDays(today, -21), kind: "test", value: 166, data: { test: "garmin_lt", note: "Beispiel" } });

  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  for (const c of chunk(acts, 400)) await q(
    `insert into activities (user_id, provider, external_id, start_time, day, sport, category, name, duration_s, avg_hr, avg_power, has_power, load, is_demo)
     select $1, x.provider, x.external_id, x.start_time, x.day, x.sport, x.category, x.name, x.duration_s, x.avg_hr, x.avg_power, coalesce(x.has_power,false), x.load, true
       from jsonb_to_recordset($2::jsonb) as x(provider text, external_id text, start_time timestamptz, day date, sport text, category text, name text, duration_s int, avg_hr numeric, avg_power numeric, has_power boolean, load numeric)
     on conflict do nothing`, [userId, JSON.stringify(c)]);
  for (const c of chunk(daily, 400)) await q(
    `insert into daily_metrics (user_id, day, provider, hrv, rhr, sleep_h, steps, is_demo)
     select $1, x.day, x.provider, x.hrv, x.rhr, x.sleep_h, x.steps, true from jsonb_to_recordset($2::jsonb) as x(day date, provider text, hrv numeric, rhr numeric, sleep_h numeric, steps int)
     on conflict do nothing`, [userId, JSON.stringify(c)]);
  for (const c of chunk(manual, 400)) await q(
    `insert into manual_entries (user_id, day, kind, value, data, is_demo)
     select $1, x.day, x.kind, x.value, x.data, true from jsonb_to_recordset($2::jsonb) as x(day date, kind text, value numeric, data jsonb)`, [userId, JSON.stringify(c)]);
  return acts.length + daily.length + manual.length;
}

export async function clearDemo(userId) {
  await q("delete from activities where user_id=$1 and is_demo", [userId]);
  await q("delete from daily_metrics where user_id=$1 and is_demo", [userId]);
  await q("delete from manual_entries where user_id=$1 and is_demo", [userId]);
}
