// KI-Tagesempfehlung: Daten zusammenstellen, Claude fragen, pro Tag speichern.
import * as repo from "./repo";
import { buildSeries, todayIso, addDays } from "./metrics";
import { writeAdvice, aiReady } from "./ai";
import { TEST_TYPES, triggerName } from "./catalog";
import { computeStates, personalContext, REGIONS, STATE_NAMES } from "./state";
import { analyzeTriggers, triggerLine } from "./triggers";
import { decide } from "./decide";

// Alles für "heute" an einem Ort: Reihe, Zustände, Einordnung, Trigger-Erfahrung, Entscheidung
export async function todayModel(userId) {
  const user = await repo.getUser(userId);
  const today = todayIso();
  const series = await buildSeries(userId, addDays(today, -364), today);
  const st = computeStates(series.all), cx = personalContext(series.all);
  const triggers = analyzeTriggers(series.all, series.activities);
  const decision = decide({ all: series.all, st, zones: series.zones, profile: user || {}, triggers });
  return { user, today, ...series, st, cx, triggers, decision };
}

const r = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };

export async function adviceContext(userId) {
  const { user, today, all, activities, zones, st, cx, triggers, decision } = await todayModel(userId);
  const T = all[all.length - 1] || {};
  const last28 = all.slice(-29, -1);
  const manual = await repo.getManual(userId);
  const latest = (k) => manual.filter((m) => m.kind === k).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const inbody = latest("inbody");
  return {
    entscheidung: decision,
    trigger_erfahrung: triggers.filter((t) => t.level !== "zu wenig Daten").slice(0, 5).map(triggerLine).filter(Boolean),
    datum: today,
    wochentag: new Date(today + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "long" }),
    profil: { sport: user?.sport || null, gewicht_kg: r(user?.weight_kg), alter: user?.birth_year ? new Date().getFullYear() - user.birth_year : null, ftp_w: zones.ftp || null, schwellenpuls: zones.lthr || null },
    heute: {
      tagesform_0_100: T.score ?? null, hrv_ms: r(T.hrv, 0), ruhepuls: r(T.rhr, 0), schlaf_h: r(T.sleep), sleep_score: r(T.sleepScore, 0),
      tiefschlaf_h: r(T.deep), rem_h: r(T.rem), body_battery_max: r(T.bbHigh, 0), stress: r(T.stress, 0), training_readiness: r(T.readiness, 0),
      abweichung_sigma: T.z ? { hrv: r(T.z.hrv), ruhepuls_invertiert: r(T.z.rhr), schlaf: r(T.z.sleep), form: r(T.z.tsb) } : null,
      fitness_ctl: r(T.ctl, 0), ermuedung_atl: r(T.atl, 0), form_tsb: r(T.tsb, 0),
      trigger_vorabend: (T.night || []).map((t) => `${triggerName(t.t)}${t.n ? ` ×${t.n}` : ""}`),
    },
    zustaende: st ? Object.fromEntries(Object.entries(st.states).map(([k, x]) => [STATE_NAMES[k], { wert_0_100: x.value, faktoren: x.drivers.map((d) => d.t), ...(k === "muscle" ? { bereiche: Object.fromEntries(Object.entries(x.regions).map(([r, v]) => [REGIONS[r], v.value])) } : {}) }])) : null,
    limiter: st?.limiter ? `${st.limiter.name}: ${st.limiter.why || ""}` : null,
    datenqualitaet: st ? `${st.quality.level}, ${st.quality.have}/${st.quality.of} Signale${st.quality.missing.length ? `, fehlt: ${st.quality.missing.join(", ")}` : ""}` : null,
    check_in_heute: T.checkin ? { energie_1_5: T.checkin.energy, motivation_1_5: T.checkin.motivation, stress_1_5: T.checkin.stress, muskelkater_0_3: T.checkin.soreness, zeit_fuer_training_min: T.checkin.time_min, notiz: T.checkin.note } : null,
    persoenliche_einordnung: cx.map((m) => ({ wert: m.label, heute: m.value, vs_28_tage_pct: m.delta == null ? null : Math.round(m.delta * 10) / 10, perzentil_12_monate: m.pct })),
    baseline_28_tage: { hrv_ms: r(mean(last28.map((d) => d.hrv)), 0), ruhepuls: r(mean(last28.map((d) => d.rhr)), 0), schlaf_h: r(mean(last28.map((d) => d.sleep))), last_pro_tag: r(mean(last28.map((d) => d.load)), 0) },
    letzte_14_tage: all.slice(-15, -1).map((d) => ({ tag: d.day, form: d.score ?? null, hrv: r(d.hrv, 0), rp: r(d.rhr, 0), schlaf: r(d.sleep), last_ausdauer: r(d.end, 0), last_kraft: r(d.str, 0), trigger: d.triggers.map((t) => t.t) })),
    letzte_einheiten: activities.slice(0, 10).map((a) => ({ tag: a.day, name: a.name || a.sport, art: a.category === "str" ? "Kraft" : a.category === "other" ? "Alltag" : "Ausdauer", min: Math.round(a.duration_s / 60), puls: r(a.avg_hr, 0), watt: r(a.np_power || a.avg_power, 0), last: r(a.load, 0), gefuehl_1_10: a.rpe || null, bereich: a.region || null })),
    koerper: { gewicht_kg: r(latest("weight")?.value), koerperfett_pct: r(latest("bodyfat")?.value), inbody: inbody ? { tag: inbody.day, ...inbody.data } : null },
    tests: manual.filter((m) => m.kind === "test").sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 4).map((t) => ({ tag: t.day, test: TEST_TYPES[t.data?.test]?.name || t.data?.test, wert: Number(t.value), einheit: TEST_TYPES[t.data?.test]?.unit })),
  };
}

export async function getTodayAdvice(userId) {
  const all = await repo.getAdvice(userId);
  return all[todayIso()] || null;
}

export async function makeAdvice(userId) {
  const ctx = await adviceContext(userId);
  if (!ctx.entscheidung) throw new Error("Noch zu wenige Daten für eine Empfehlung.");
  const a = await writeAdvice(ctx);
  const entry = { ...a, day: ctx.datum, created_at: new Date().toISOString(), score: ctx.heute.tagesform_0_100, decision_key: ctx.entscheidung.key };
  await repo.saveAdvice(userId, ctx.datum, entry);
  return entry;
}

// Für den täglichen Lauf: allen mit Daten eine frische Empfehlung schreiben.
export async function adviceForAll() {
  if (!(await aiReady())) return { skipped: true };
  let ok = 0, fail = 0;
  for (const u of await repo.listUsers()) {
    if (!(await repo.getConnections(u.id)).length) continue;
    try { await makeAdvice(u.id); ok++; } catch { fail++; }
  }
  return { ok, fail };
}
