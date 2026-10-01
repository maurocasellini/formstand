import { categorize } from "../load";

const BASE = process.env.INTERVALS_BASE || "https://intervals.icu/api/v1";
const auth = (key) => "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64");
const iso = (d) => d.toISOString().slice(0, 10);
const n = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

async function get(key, path) {
  const r = await fetch(`${BASE}${path}`, { headers: { authorization: auth(key), accept: "application/json" } });
  if (r.status === 401 || r.status === 403) throw new Error("intervals.icu: API-Schlüssel oder Athleten-ID stimmt nicht");
  if (r.status === 429) throw new Error("intervals.icu: Limit erreicht, später erneut");
  if (!r.ok) throw new Error(`intervals.icu ${path.split("?")[0]} (${r.status})`);
  return r.json();
}

// Ein Wellness-Eintrag von intervals.icu → Tageswerte (Quelle: Garmin, über intervals.icu)
export function mapWellness(w) {
  const day = String(w.id || w.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const row = {
    provider: "garmin", day,
    hrv: n(w.hrv), rhr: n(w.restingHR), sleep_h: n(w.sleepSecs) != null ? Math.round((n(w.sleepSecs) / 3600) * 100) / 100 : null,
    sleep_score: n(w.sleepScore), avg_sleep_hr: n(w.avgSleepingHR), spo2: n(w.spO2), respiration: n(w.respiration),
    readiness: n(w.readiness), vo2max: n(w.vo2max), steps: n(w.steps), stress_avg: n(w.stress), weight: n(w.weight),
  };
  const has = Object.entries(row).some(([k, v]) => !["provider", "day"].includes(k) && v != null);
  return has ? row : null;
}

export function mapActivity(a) {
  // Von Strava importierte Aktivitäten liefert intervals.icu per API nicht aus (nur Platzhalter).
  if (!a || (!a.moving_time && !a.elapsed_time)) return null;
  const sport = a.type || "Workout";
  const start = a.start_date || a.start_date_local;
  return {
    provider: "intervals", external_id: String(a.id), start_time: start, day: String(a.start_date_local || start).slice(0, 10),
    sport, category: categorize(sport), name: a.name || sport, duration_s: Math.round(n(a.moving_time) || n(a.elapsed_time) || 0),
    distance_m: n(a.distance), avg_hr: n(a.average_heartrate), max_hr: n(a.max_heartrate),
    avg_power: n(a.icu_average_watts ?? a.average_watts), np_power: n(a.icu_weighted_avg_watts ?? a.weighted_average_watts),
    kj: n(a.icu_joules) != null ? Math.round(n(a.icu_joules) / 1000) : null, kcal: n(a.calories),
    has_power: n(a.icu_average_watts ?? a.average_watts) != null, load: n(a.icu_training_load),
  };
}

export const intervals = {
  id: "intervals",
  name: "intervals.icu",
  kind: "Garmin automatisch: Workouts, HRV, Ruhepuls, Schlaf, SpO2, VO2max",
  apiKey: true,
  setup: "Gratis-Konto auf intervals.icu, dort unter Settings → Connections Garmin verbinden. Dann unter Settings → Developer Settings den API-Schlüssel und die Athleten-ID (beginnt mit i) kopieren.",

  async verify(athleteId, key) {
    const a = await get(key, `/athlete/${encodeURIComponent(athleteId || "0")}`);
    return { external_id: String(a.id || athleteId), name: a.name || null };
  },

  async fetchSince(key, since, conn) {
    const id = encodeURIComponent(conn?.external_id || "0");
    const oldest = iso(since), newest = iso(new Date(Date.now() + 864e5));
    const [well, acts] = await Promise.all([
      get(key, `/athlete/${id}/wellness?oldest=${oldest}&newest=${newest}`),
      get(key, `/athlete/${id}/activities?oldest=${oldest}&newest=${newest}`),
    ]);
    const wl = Array.isArray(well) ? well : [], al = Array.isArray(acts) ? acts : [];
    return {
      raw: [
        ...wl.map((w) => ({ kind: "wellness", external_id: String(w.id), payload: w })),
        ...al.map((a) => ({ kind: "activity", external_id: String(a.id), payload: a })),
      ],
      daily: wl.map(mapWellness).filter(Boolean),
      activities: al.map(mapActivity).filter(Boolean),
    };
  },
};
