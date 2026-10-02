// KI-Tagesempfehlung: Daten zusammenstellen, Claude fragen, pro Tag speichern.
import * as repo from "./repo";
import { buildSeries, todayIso, addDays } from "./metrics";
import { writeAdvice, writeFeedback, writeBrief } from "./ai";
import { TEST_TYPES, triggerName } from "./catalog";
import { computeStates, personalContext, REGIONS, STATE_NAMES } from "./state";
import { analyzeTriggers, triggerLine } from "./triggers";
import { decide } from "./decide";
import { phaseFor, planFor, weekPlan, adaptWeek, mondayOf } from "./plan";
import { learn } from "./learn";
import { addDays as addD } from "./metrics";
import { decisionAt, actualOf, match, review } from "./adherence";
import { periods, periodFeedback, feedbackBrief } from "./feedback";
import { WEAKNESSES, EVENT_TYPES, FOCUS } from "./catalog";
import { fitnessProfile, fitnessBrief } from "./fitness";
import { targetsOf, targetsBrief } from "./targets";
import { findings } from "./overview";
import { vo2Summary } from "./vo2";
import { trendDetails, trendsBrief } from "./trends";
import { cycleInfo, cycleBrief } from "./cycle";
import { foodSummary } from "./nutrition";
import { activeNotes, notesBrief } from "./coachnotes";

// Alles für "heute" an einem Ort: Reihe, Zustände, Einordnung, Trigger-Erfahrung, Entscheidung
export async function todayModel(userId) {
  const [user0, goals] = await Promise.all([repo.getUser(userId), repo.getGoals(userId)]);
  const today = todayIso();
  const series = await buildSeries(userId, addDays(today, -364), today);
  // Gewicht für Berechnungen: neuster Messwert der letzten 14 Tage (Waage, InBody, intervals.icu), sonst Profil
  const recentW = [...series.all.slice(-14)].reverse().find((d) => d.weight != null)?.weight;
  const user = user0 ? { ...user0, weight_kg: recentW != null ? Math.round(recentW * 10) / 10 : user0.weight_kg } : user0;
  const st = computeStates(series.all), cx = personalContext(series.all);
  const triggers = analyzeTriggers(series.all, series.activities);
  const hasGoals = Boolean(goals.updated_at || goals.events?.length);
  const ctx = { goals: hasGoals ? goals : null, zones: series.zones, profile: user || {}, triggers };
  const phase = hasGoals ? phaseFor(goals, today) : null;
  // Adaptiv: verpasste harte Einheiten der Woche wandern nach vorne (1. Durchgang, heute darf übernehmen)
  const hardDays = new Set(series.all.filter((d) => (d.hardSessions || []).some((h) => h.category === "end")).map((d) => d.day));
  const planned = hasGoals ? planFor(goals, today, user || {}, series.zones, { hardDays }) : null;
  const learned = learn(series.all);
  const manual = await repo.getManual(userId);
  const latest = (k) => manual.filter((x) => x.kind === k).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const nutritionCtx = { focus: goals.focus, bmr: latest("inbody")?.data?.bmr_kcal || null, bodyfat: latest("bodyfat") ? Number(latest("bodyfat").value) : null, rate: goals.rate };
  const decision = decide({ all: series.all, st, zones: series.zones, profile: user || {}, triggers, planned, phase, nutritionCtx, learned });
  // Woche nach der heutigen Entscheidung (2. Durchgang): heute gestrichene Qualität wandert weiter
  const week = hasGoals ? adaptWeek(weekPlan(goals, mondayOf(today), user || {}, series.zones).items, { today, hardDays, todayType: decision?.type || null }) : null;
  const nextWeek = hasGoals ? weekPlan(goals, addD(mondayOf(today), 7), user || {}, series.zones).items : null;
  const upcoming = hasGoals ? [...week, ...nextWeek].filter((x) => x.day > today).slice(0, 3) : [];
  // Gestern: Empfehlung vs. tatsächliches Training vs. heutiger Morgen
  let yesterday = null;
  const n = series.all.length;
  if (n > 40) {
    const rec = decisionAt(series.all, n - 2, ctx);
    if (rec) { const act = actualOf(series.all[n - 2]); yesterday = { rec: { ...rec, title: rec.title.replace(/^Heute: /, "") }, act, status: match(rec, act), scoreThen: series.all[n - 2].score, scoreNow: series.all[n - 1].score }; }
  }
  return { user, today, ...series, st, cx, triggers, decision, goals, hasGoals, phase, planned, ctx, yesterday, manual, learned, week, upcoming, hardDays };
}

const r = (v, d = 1) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** d) / 10 ** d);
const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };

export async function adviceContext(userId) {
  const { user, today, all, activities, zones, st, cx, triggers, decision, goals, hasGoals, phase } = await todayModel(userId);
  const manualAll = await repo.getManual(userId);
  const vo2 = vo2Summary(all, manualAll, user || {}, today);
  const fp = fitnessProfile(manualAll, { sex: user?.sex, kg: user?.weight_kg, goals, profile: user || {}, today, vo2 });
  const T = all[all.length - 1] || {};
  const last28 = all.slice(-29, -1);
  const manual = await repo.getManual(userId);
  const latest = (k) => manual.filter((m) => m.kind === k).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const inbody = latest("inbody");
  return {
    entscheidung: decision,
    ziele: hasGoals ? { fokus: FOCUS[goals.focus]?.[0], schwaechen: [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean).map((w) => WEAKNESSES[w]?.[0]), notiz: goals.note || null,
      phase: phase?.label, naechster_wettkampf: phase?.event ? { name: phase.event.name, art: EVENT_TYPES[phase.event.type]?.[0], datum: phase.event.date, in_tagen: phase.daysTo, prioritaet: phase.event.priority, ziel: phase.event.target || null } : null } : null,
    trigger_erfahrung: triggers.filter((t) => t.level !== "zu wenig Daten").slice(0, 5).map(triggerLine).filter(Boolean),
    datum: today,
    wochentag: new Date(today + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "long" }),
    profil: { sport: user?.sport || null, gewicht_kg: r(user?.weight_kg), alter: user?.birth_year ? new Date().getFullYear() - user.birth_year : null, ftp_w: zones.ftp || null, schwellenpuls: zones.lthr || null, vo2max: vo2 ? { wert: vo2.cur, quelle: vo2.src, einordnung: vo2.cls?.name || null, fitnessalter: vo2.fitAge, veraenderung_3_monate: vo2.d90, veraenderung_12_monate: vo2.d365 } : null },
    heute: {
      tagesform_0_100: T.score ?? null, tagesform_basis: T.score == null ? null : T.scoreObj == null ? "nur Check-in (keine Messwerte)" : T.checkin ? "Messwerte + Check-in" : "nur Messwerte", hrv_ms: r(T.hrv, 0), ruhepuls: r(T.rhr, 0), schlaf_h: r(T.sleep), sleep_score: r(T.sleepScore, 0),
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
    koerper_analyse: await (async () => { const a = Object.values(await repo.getBodyAnalyses(userId)).sort((x, y) => (x.day < y.day ? 1 : -1))[0]; return a ? { datum: a.day, einschaetzung: a.zusammenfassung, koerperfett_geschaetzt: a.kf, potenzial: a.defizite, trainingsfokus: a.training.map((t) => t.titel) } : null; })(),
    tests: manual.filter((m) => m.kind === "test" && TEST_TYPES[m.data?.test]?.group === "diagnostik").sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 4).map((t) => ({ tag: t.day, test: TEST_TYPES[t.data?.test]?.name || t.data?.test, wert: Number(t.value), einheit: TEST_TYPES[t.data?.test]?.unit })),
    fitness_profil: fitnessBrief(fp),
    zyklus: user?.cycle_on && user?.cycle_ai !== false ? cycleBrief(cycleInfo({ user, manual: manualAll, all, today })) : null,
    ernaehrung_gegessen_7_tage: foodSummary(all, 7),
    rueckmeldungen_des_sportlers: notesBrief(activeNotes(manualAll, today)),
    auffaelligkeiten: findings(all, { activities, st, goals, triggers }).slice(0, 5).map((f) => `${f.title}: ${f.text}`),
    messbare_ziele: targetsBrief(targetsOf(goals, manualAll, all, today)),
  };
}

export async function getTodayAdvice(userId) {
  const all = await repo.getAdvice(userId);
  return all[todayIso()] || null;
}

export async function makeAdvice(userId) {
  const ctx = await adviceContext(userId);
  if (!ctx.entscheidung) throw new Error("Noch zu wenige Daten für eine Empfehlung.");
  const a = await writeAdvice(ctx, userId);
  const entry = { ...a, day: ctx.datum, created_at: new Date().toISOString(), score: ctx.heute.tagesform_0_100, decision_key: ctx.entscheidung.key };
  await repo.saveAdvice(userId, ctx.datum, entry);
  return entry;
}

// Rückblick & Feedback: alle Zeiträume regelbasiert (für Übersicht und KI)
export async function feedbackModel(userId, m = null) {
  m = m || (await todayModel(userId));
  const { all, goals, hasGoals, ctx, today, manual, user } = m;
  const rows = review(all, { ...ctx, goals: hasGoals ? goals : null }, 95);
  const targets = targetsOf(goals, manual, all, today);
  const vo2 = vo2Summary(all, manual, user || {}, today);
  return periods(today).map((P) => periodFeedback(all, rows, P, { goals, targets, vo2 }));
}
export async function makeFeedback(userId, key) {
  const m = await todayModel(userId);
  const f = (await feedbackModel(userId, m)).find((x) => x.key === key);
  if (!f) throw new Error("Unbekannter Zeitraum.");
  const vo2 = vo2Summary(m.all, m.manual, m.user || {}, m.today);
  const fp = fitnessProfile(m.manual, { sex: m.user?.sex, kg: m.user?.weight_kg, goals: m.goals, profile: m.user || {}, today: m.today, vo2 });
  const ctx = {
    ...feedbackBrief(f),
    ziele: m.hasGoals ? { fokus: FOCUS[m.goals.focus]?.[0], schwaechen: [m.goals.mainWeakness, ...(m.goals.weaknesses || [])].filter(Boolean).map((w) => WEAKNESSES[w]?.[0]), naechster_wettkampf: m.phase?.event ? { name: m.phase.event.name, datum: m.phase.event.date, in_tagen: m.phase.daysTo, phase: m.phase.label } : null } : null,
    messbare_ziele: targetsBrief(targetsOf(m.goals, m.manual, m.all, m.today)),
    fitness_profil: fitnessBrief(fp),
    vo2max: vo2 ? { wert: vo2.cur, einordnung: vo2.cls?.name || null, veraenderung_3_monate: vo2.d90 } : null,
    rueckmeldungen_des_sportlers: notesBrief(activeNotes(m.manual, m.today)),
  };
  const a = await writeFeedback(ctx, userId);
  const entry = { ...a, key: `${f.key}:${f.from}:${f.to}`, period: f.key };
  await repo.saveFeedback(userId, entry.key, entry);
  return entry;
}

// ---------- Wochenbrief ----------
// Schlüssel = Montag der Woche. Entsteht automatisch einmal pro Woche (Cron am Montag oder beim ersten Öffnen), sonst auf Knopfdruck.
export const briefKey = (today) => { const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; return `brief:${addD(today, -dow)}`; };
export async function getBrief(userId) {
  const all = await repo.getFeedback(userId);
  return Object.values(all).filter((x) => x.period === "brief" && !x.pending).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null;
}
export async function briefState(userId, today) {
  const all = await repo.getFeedback(userId), k = briefKey(today), cur = all[k];
  return { key: k, pending: Boolean(cur?.pending && Date.now() - new Date(cur.created_at).getTime() < 3 * 60e3), done: Boolean(cur && !cur.pending), error: cur?.error || null };
}
export async function makeBrief(userId) {
  const m = await todayModel(userId);
  const key = briefKey(m.today);
  await repo.saveFeedback(userId, key, { period: "brief", key, pending: true });
  try {
    const base = await adviceContext(userId);
    const fbs = await feedbackModel(userId, m);
    const ctx = {
      ...base,
      rueckblicke: fbs.map(feedbackBrief),
      auffaelligkeiten: findings(m.all, { activities: m.activities, st: m.st, goals: m.goals, triggers: m.triggers }).map((f) => `${f.title}: ${f.text}`),
      trends: trendsBrief(trendDetails(m.all)),
      plan_naechste_tage: (m.upcoming || []).map((x) => ({ tag: x.day, einheit: x.title, min: x.min })),
      woche_plan: (m.week || []).map((x) => ({ tag: x.day, einheit: x.title, min: x.min })),
    };
    delete ctx.letzte_14_tage; // Tagesdetails stecken in den Rückblicken
    const a = await writeBrief(ctx, userId);
    const entry = { ...a, period: "brief", key, week: key.slice(6) };
    await repo.saveFeedback(userId, key, entry);
    return entry;
  } catch (e) {
    await repo.saveFeedback(userId, key, { period: "brief", key, error: String(e.message || e).slice(0, 200) });
    throw e;
  }
}

// Cron (montags): Wochenbrief für alle mit KI und frischen Daten
export async function weeklyBriefs({ limit = 25 } = {}) {
  const { aiReady } = await import("./ai");
  if (!(await aiReady())) return { skipped: "keine KI" };
  const today = todayIso(), out = { made: 0, errors: 0 };
  for (const u of (await repo.listUsers()).filter((u) => !u.demo).slice(0, limit)) {
    try {
      const st = await briefState(u.id, today);
      if (st.done || st.pending) continue;
      const acts = (await repo.getActivities(u.id)).filter((a) => a.day >= addD(today, -14));
      if (!acts.length) continue;
      const br = await makeBrief(u.id); out.made++;
      // Push: der Brief ist da (nur mit eingeschalteter Erinnerung)
      try { const { sendTo } = await import("./push"); await sendTo(u.id, { title: "Dein Wochenbrief", body: `${br.titel}. ${br.fokus?.[0] ? `Fokus: ${br.fokus[0]}` : ""}`.trim(), url: "/heute#coach", tag: `brief-${today}` }); } catch {}
    } catch { out.errors++; }
  }
  return out;
}
