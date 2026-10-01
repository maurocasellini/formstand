// KI-Tagesempfehlung: Daten zusammenstellen, Claude fragen, pro Tag speichern.
import * as repo from "./repo";
import { buildSeries, todayIso, addDays } from "./metrics";
import { writeAdvice, aiReady } from "./ai";
import { TEST_TYPES, triggerName } from "./catalog";

const r = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };

export async function adviceContext(userId) {
  const user = await repo.getUser(userId);
  const today = todayIso();
  const { all, activities, zones } = await buildSeries(userId, addDays(today, -41), today);
  const T = all[all.length - 1] || {};
  const last28 = all.slice(-29, -1);
  const manual = await repo.getManual(userId);
  const latest = (k) => manual.filter((m) => m.kind === k).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const inbody = latest("inbody");
  return {
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
    baseline_28_tage: { hrv_ms: r(mean(last28.map((d) => d.hrv)), 0), ruhepuls: r(mean(last28.map((d) => d.rhr)), 0), schlaf_h: r(mean(last28.map((d) => d.sleep))), last_pro_tag: r(mean(last28.map((d) => d.load)), 0) },
    letzte_14_tage: all.slice(-15, -1).map((d) => ({ tag: d.day, form: d.score ?? null, hrv: r(d.hrv, 0), rp: r(d.rhr, 0), schlaf: r(d.sleep), last_ausdauer: r(d.end, 0), last_kraft: r(d.str, 0), trigger: d.triggers.map((t) => t.t) })),
    letzte_einheiten: activities.slice(0, 10).map((a) => ({ tag: a.day, name: a.name || a.sport, art: a.category === "str" ? "Kraft" : a.category === "other" ? "Alltag" : "Ausdauer", min: Math.round(a.duration_s / 60), puls: r(a.avg_hr, 0), watt: r(a.np_power || a.avg_power, 0), last: r(a.load, 0) })),
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
  const hasData = ctx.heute.tagesform_0_100 != null || ctx.letzte_einheiten.length > 0;
  if (!hasData) throw new Error("Noch zu wenige Daten für eine Empfehlung.");
  const a = await writeAdvice(ctx);
  const entry = { ...a, day: ctx.datum, created_at: new Date().toISOString(), score: ctx.heute.tagesform_0_100 };
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
