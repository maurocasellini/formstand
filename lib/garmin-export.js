import { categorize } from "./load";

// Liest Datensätze aus dem offiziellen Garmin-Datenexport (ZIP → DI_CONNECT/*.json).
// Die Struktur ist nicht offiziell dokumentiert; deshalb werden Felder tolerant über Alias-Namen gesucht.
// Alles, was nicht zugeordnet wird, bleibt trotzdem als Rohdaten erhalten.

const n = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

function deep(o, path) {
  return path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
}
function pick(o, paths) {
  for (const p of paths) { const v = n(deep(o, p)); if (v != null) return v; }
  return null;
}
function dayOf(o) {
  for (const k of ["calendarDate", "calendarDateStr", "summaryDate", "date", "startDate"]) {
    const v = o?.[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (v && typeof v === "object" && typeof v.date === "string") return v.date.slice(0, 10);
  }
  for (const k of ["sleepEndTimestampGMT", "sleepEndTimestampLocal", "timestampGMT"]) {
    const v = o?.[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    if (typeof v === "number" && v > 1e11) return new Date(v).toISOString().slice(0, 10);
  }
  return null;
}
function statFrom(list, type, key = "statsValue") {
  if (!Array.isArray(list)) return null;
  const it = list.find((x) => String(x?.bodyBatteryStatType || x?.type || "").toUpperCase().includes(type));
  return it ? n(it[key] ?? it.value) : null;
}

export function kindOfFile(name) {
  const f = name.toLowerCase();
  if (f.includes("summarizedactivities")) return "activities";
  if (f.includes("sleepdata") || f.includes("sleep_data")) return "sleep";
  if (f.includes("udsfile") || f.includes("uds_file")) return "daily";
  if (f.includes("trainingreadiness")) return "readiness";
  if (f.includes("hrv")) return "hrv";
  if (f.includes("maxmet") || f.includes("vo2")) return "vo2max";
  if (f.includes("biometric") || f.includes("weight")) return "weight";
  if (f.includes("healthstatus") || f.includes("skintemp")) return "health";
  if (f.includes("trainingstatus") || f.includes("acutetrainingload")) return "trainingstatus";
  return "other";
}

// Flacht verschachtelte Exporte ab: [{summarizedActivitiesExport:[…]}] → […]
export function flatten(json) {
  if (Array.isArray(json)) return json.flatMap((x) => (x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 1 && Array.isArray(Object.values(x)[0]) ? Object.values(x)[0] : [x]));
  if (json && typeof json === "object") {
    const arr = Object.values(json).find(Array.isArray);
    return arr || [json];
  }
  return [];
}

export function mapDaily(kind, o) {
  const day = dayOf(o);
  if (!day) return null;
  const row = { provider: "garmin", day };
  if (kind === "daily" || kind === "other" || kind === "health") {
    row.rhr = pick(o, ["restingHeartRate", "currentDayRestingHeartRate", "restingHeartRateValue"]);
    row.steps = pick(o, ["totalSteps", "steps"]);
    row.stress_avg = pick(o, ["averageStressLevel", "avgStressLevel"]) ?? (Array.isArray(o.allDayStress?.aggregatorList) ? n(o.allDayStress.aggregatorList.find((a) => a.type === "TOTAL")?.averageStressLevel) : null);
    row.bb_high = pick(o, ["bodyBatteryHighestValue", "maxBodyBattery"]) ?? statFrom(o.bodyBattery?.bodyBatteryStatList, "HIGHEST");
    row.bb_low = pick(o, ["bodyBatteryLowestValue", "minBodyBattery"]) ?? statFrom(o.bodyBattery?.bodyBatteryStatList, "LOWEST");
    row.spo2 = pick(o, ["averageSpo2Value", "averageSpO2", "avgSpo2", "averageSpo2"]);
    row.respiration = pick(o, ["avgWakingRespirationValue", "averageRespirationValue", "averageRespiration"]);
    const mod = pick(o, ["moderateIntensityMinutes"]), vig = pick(o, ["vigorousIntensityMinutes"]);
    row.intensity_min = mod != null || vig != null ? (mod || 0) + 2 * (vig || 0) : null;
    row.skin_temp = pick(o, ["skinTempDeviationC", "avgSkinTempDeviationC", "skinTemperatureDeviation"]);
  }
  if (kind === "sleep") {
    const deepS = pick(o, ["deepSleepSeconds"]), light = pick(o, ["lightSleepSeconds"]), rem = pick(o, ["remSleepSeconds"]), awake = pick(o, ["awakeSleepSeconds"]);
    if (deepS != null || light != null || rem != null) row.sleep_h = r2(((deepS || 0) + (light || 0) + (rem || 0)) / 3600);
    row.deep_h = deepS != null ? r2(deepS / 3600) : null; row.light_h = light != null ? r2(light / 3600) : null;
    row.rem_h = rem != null ? r2(rem / 3600) : null; row.awake_h = awake != null ? r2(awake / 3600) : null;
    row.sleep_score = pick(o, ["sleepScores.overallScore", "sleepScores.overall.value", "overallSleepScore.value", "sleepScore", "overallScore"]);
    row.respiration = pick(o, ["averageRespiration", "avgSleepRespirationValue"]);
    row.spo2 = pick(o, ["averageSpO2Value", "avgSleepSpo2", "spo2SleepSummary.averageSPO2"]);
    row.avg_sleep_hr = pick(o, ["averageHeartRate", "avgSleepHeartRate", "restingHeartRate"]);
  }
  if (kind === "hrv") row.hrv = pick(o, ["hrvSummary.lastNightAvg", "lastNightAvg", "lastNight5MinHigh", "weeklyAvg"]);
  if (kind === "readiness") row.readiness = pick(o, ["score", "trainingReadinessScore", "level.score"]);
  if (kind === "vo2max") row.vo2max = pick(o, ["vo2MaxPreciseValue", "vo2MaxValue", "generic.vo2MaxPreciseValue", "generic.vo2MaxValue", "cycling.vo2MaxValue"]);
  if (kind === "weight") { const w = pick(o, ["weight", "weightInGrams"]); row.weight = w == null ? null : w > 1000 ? r2(w / 1000) : w; }
  const has = Object.entries(row).some(([k, v]) => !["provider", "day"].includes(k) && v != null);
  return has ? row : null;
}

export function mapActivity(o) {
  const id = o.activityId ?? o.activityUUID ?? o.id;
  const startMs = n(o.startTimeGmt) ?? n(o.beginTimestamp) ?? (o.startTimeGMT ? Date.parse(o.startTimeGMT + "Z") : null);
  if (id == null || !startMs) return null;
  const localMs = n(o.startTimeLocal) ?? startMs;
  let dur = pick(o, ["movingDuration", "duration", "elapsedDuration"]) || 0;
  if (dur > 100000) dur = dur / 1000; // Export liefert ms
  let dist = n(o.distance);
  if (dist != null && dist > 0 && dur > 0 && dist / dur > 30) dist = dist / 100; // cm → m
  const sport = typeof o.activityType === "string" ? o.activityType : o.activityType?.typeKey || o.sportType || "workout";
  return {
    provider: "garmin", external_id: String(id), start_time: new Date(startMs).toISOString(), day: new Date(localMs).toISOString().slice(0, 10),
    sport, category: categorize(sport), name: o.name || sport, duration_s: Math.round(dur), distance_m: dist,
    avg_hr: pick(o, ["avgHr", "averageHR", "averageHeartRate"]), max_hr: pick(o, ["maxHr", "maxHR"]),
    avg_power: pick(o, ["avgPower", "averagePower"]), np_power: pick(o, ["normPower", "normalizedPower"]),
    kcal: pick(o, ["calories"]), has_power: pick(o, ["avgPower", "averagePower"]) != null,
    load: pick(o, ["activityTrainingLoad", "trainingLoad"]),
  };
}

export function mapFile(fileName, records) {
  const kind = kindOfFile(fileName);
  const daily = [], activities = [];
  for (const rec of records) {
    if (!rec || typeof rec !== "object") continue;
    if (kind === "activities") { const a = mapActivity(rec); if (a) activities.push(a); continue; }
    const d = mapDaily(kind, rec); if (d) daily.push(d);
  }
  return { kind, daily, activities };
}

// Mehrere Einträge pro Tag (z. B. Schlaf + Tageswerte) zusammenführen
export function mergeDaily(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.provider + r.day, cur = m.get(k) || { provider: r.provider, day: r.day };
    for (const [key, v] of Object.entries(r)) if (v != null && cur[key] == null) cur[key] = v;
    m.set(k, cur);
  }
  return [...m.values()];
}
