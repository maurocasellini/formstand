"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { putFile, readFile, removeFile, filesReady } from "@/lib/files";
import crypto from "node:crypto";
import * as repo from "@/lib/repo";
import { viewerAndSubject } from "@/lib/subject";
import { seedDemo, clearDemo } from "@/lib/demo";
import { syncUser, syncConnection, athleteZones } from "@/lib/sync";
import { weekPlan, mondayOf } from "@/lib/plan";
import { todayIso, buildSeries, addDays } from "@/lib/metrics";
import { encrypt } from "@/lib/crypto";
import { intervals } from "@/lib/providers/intervals";
import { aiReady, comparePhotos as aiComparePhotos, findEvent as aiFindEvent, classifyUpload } from "@/lib/ai";
import { applyInBody, AI_IMAGE_TYPES } from "@/lib/inbody";
import { runBodyAnalysis } from "@/lib/bodyai";
import { applyTest } from "@/lib/testread";
import { makeAdvice, makeFeedback, makeBrief } from "@/lib/coach";
import { sendTo } from "@/lib/push";
import { TARGET_METRICS, seriesOf, ambition, goalEffects } from "@/lib/targets";
import { SYMPTOMS } from "@/lib/cycle";
import { parseNutritionCsv } from "@/lib/nutrition";
import { WEAKNESSES, EVENT_TYPES, FOCUS, MEDIA_KINDS, TRIGGERS, TEST_TYPES, TEST_RANGE, TEST_DURATIONS, testText } from "@/lib/catalog";

async function ctx() {
  const { viewer, subject } = await viewerAndSubject();
  return { viewer, subject, demo: viewer.demo };
}
const DEMO = { error: "In der Demo kann man nur schauen. Mit eigenem Konto geht alles." };
const dayOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : todayIso());
// «3:35» → 215, «1:02:30» → 3750, «215» → 215
const timeOf = (v) => { const p = String(v || "").replace(",", ".").split(":").map((x) => Number(x)); if (!p.length || p.some((x) => !Number.isFinite(x) || x < 0)) return null; const s = p.reduce((a, x) => a * 60 + x, 0); return s > 0 ? Math.round(s * 10) / 10 : null; };
const numOf = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };

export async function addManual(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const kind = String(form.get("kind"));
  const day = dayOf(form.get("day"));
  const value = numOf(form.get("value"));
  const data = {};
  if (kind === "trigger") data.t = String(form.get("t") || "alkohol").slice(0, 40);
  let val = value;
  if (kind === "test") {
    data.test = String(form.get("test") || "ramp"); data.note = String(form.get("note") || "").slice(0, 80);
    const t = TEST_TYPES[data.test];
    if (!t) return { error: "Unbekannter Test." };
    // Zeiten als m:ss (oder h:mm:ss / Sekunden)
    if (t.fmt === "time" || t.fmt === "pace") { const raw = String(form.get("time") || form.get("value") || "").trim(); val = timeOf(raw); if (val == null) return { error: "Zeit bitte als m:ss eingeben, z. B. 3:35." }; }
    if (t.fmt === "lift") { const r = Math.round(numOf(form.get("reps")) || 0); if (r < 1 || r > 5) return { error: "Wiederholungen 1–5 wählen." }; data.reps = r; }
    if (t.dur) { const d = Math.round(numOf(form.get("dur")) || 0); if (!TEST_DURATIONS.includes(d)) return { error: "Dauer wählen." }; data.dur = d; }
    const R = TEST_RANGE[data.test];
    if (R && (val == null || val < R[0] || val > R[1])) return { error: `Wert ausserhalb des plausiblen Bereichs (${R[0]}–${R[1]}${t.fmt === "time" || t.fmt === "pace" ? " s" : ` ${t.unit}`}).` };
  }
  if (kind === "note") data.text = String(form.get("text") || "").slice(0, 500);
  if (!["weight", "bodyfat", "trigger", "test", "note"].includes(kind)) return { error: "Unbekannte Eingabe." };
  if (kind !== "note" && kind !== "trigger" && (val == null || val <= 0)) return { error: "Bitte einen gültigen Wert eingeben." };
  await repo.addManual(subject.id, { day, kind, value: kind === "trigger" ? (value || 1) : val, data, created_by: viewer.id });
  if (kind === "test") { revalidatePath("/", "layout"); return { ok: `Gespeichert: ${TEST_TYPES[data.test].name} ${testText(data.test, val, data)}.` }; }
  if (kind === "weight") await repo.updateUser(subject.id, { weight_kg: value });
  revalidatePath("/", "layout");
  return { ok: "Gespeichert." };
}

// ---------- Ernährung: MyFitnessPal / Cronometer (CSV) ----------
export async function importNutrition(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const f = form.get("file");
  if (!f || typeof f !== "object" || !f.size) return { error: "Bitte die CSV-Datei wählen." };
  if (f.size > 8 * 1024 * 1024) return { error: "Datei grösser als 8 MB." };
  let days;
  try { days = parseNutritionCsv(await f.text()); } catch (e) { return { error: String(e.message || e) }; }
  const src = /cronometer/i.test(f.name) ? "Cronometer" : "MyFitnessPal";
  const set = new Set(days.map((d) => d.day));
  await repo.deleteManualWhere(subject.id, (e) => e.kind === "food" && set.has(e.day));
  await repo.addManualMany(subject.id, days.map((d) => ({ day: d.day, kind: "food", value: d.kcal, data: { kcal: d.kcal, carbs_g: d.carbs_g, protein_g: d.protein_g, fat_g: d.fat_g, meals: d.meals, src }, created_by: viewer.id })));
  revalidatePath("/", "layout");
  return { ok: `${days.length} Tage übernommen (${days[0].day.split("-").reverse().join(".")} – ${days.at(-1).day.split("-").reverse().join(".")}), Ø ${Math.round(days.reduce((s, d) => s + d.kcal, 0) / days.length).toLocaleString("de-CH")} kcal.` };
}

// ---------- Zyklus (nur Frauen, Opt-in) ----------
export async function addPeriod(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (viewer.id !== subject.id) return { error: "Zyklusdaten trägt nur die Person selbst ein." };
  const day = dayOf(form.get("day"));
  if ((await repo.getManual(subject.id)).some((e) => e.kind === "period" && e.day === day)) return { ok: "Schon eingetragen." };
  await repo.addManual(subject.id, { day, kind: "period", value: null, data: {}, created_by: viewer.id });
  revalidatePath("/", "layout");
  return { ok: `Periodenbeginn ${day.split("-").reverse().join(".")} gespeichert.` };
}
export async function saveCycleSymptoms(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (viewer.id !== subject.id) return { error: "Zyklusdaten trägt nur die Person selbst ein." };
  const day = dayOf(form.get("day"));
  const s = form.getAll("s").map(String).filter((x) => SYMPTOMS.some(([k]) => k === x));
  for (const e of (await repo.getManual(subject.id)).filter((e) => e.kind === "cycle_sym" && e.day === day)) await repo.deleteManual(subject.id, e.id);
  if (s.length) await repo.addManual(subject.id, { day, kind: "cycle_sym", value: s.length, data: { s }, created_by: viewer.id });
  revalidatePath("/", "layout");
  return { ok: s.length ? "Symptome gespeichert." : "Symptome entfernt." };
}

// Einflussfaktoren: Alkohol (Gläser) getrennt, weitere Faktoren zum Antippen. Ein Abend oder viele Abende (Nachtragen).
const FACTOR_KEYS = new Set(TRIGGERS.map((x) => x[0]));
const eveningOf = (form, sfx = "") => {
  const out = [];
  const alc = Math.max(0, Math.min(20, Math.round(numOf(form.get(`alc${sfx}`)) || 0)));
  if (alc > 0) out.push({ t: "alkohol", n: alc });
  for (const f of form.getAll(`f${sfx}`).map(String)) if (FACTOR_KEYS.has(f) && f !== "alkohol" && !out.some((x) => x.t === f)) out.push({ t: f, n: 1 });
  return out;
};
export async function saveEvening(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const day = dayOf(form.get("day"));
  if (day > todayIso()) return { error: "Datum liegt in der Zukunft." };
  const list = eveningOf(form);
  await repo.setTriggers(subject.id, { [day]: list }, viewer.id);
  revalidatePath("/", "layout");
  return { ok: list.length ? `Gespeichert für ${day.split("-").reverse().join(".")}.` : `Für ${day.split("-").reverse().join(".")} ist nichts mehr eingetragen.` };
}
export async function saveEveningGrid(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const days = String(form.get("days") || "").split(",").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayIso()).slice(0, 62);
  const byDay = Object.fromEntries(days.map((d) => [d, eveningOf(form, `_${d}`)]));
  await repo.setTriggers(subject.id, byDay, viewer.id);
  revalidatePath("/", "layout");
  return { ok: `${days.length} Tage gespeichert.` };
}

export async function deleteManual(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await repo.deleteManual(subject.id, String(form.get("id")));
  revalidatePath("/", "layout");
}

export async function updateProfile(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  // Nur Felder ändern, die das Formular mitschickt (Konto: Sportart/Jahrgang, Körper: Grösse)
  const patch = {};
  if (form.has("sport")) patch.sport = String(form.get("sport") || "").slice(0, 40) || null;
  if (form.has("birth_year")) patch.birth_year = numOf(form.get("birth_year"));
  if (form.has("sex")) { patch.sex = ["m", "w"].includes(String(form.get("sex"))) ? String(form.get("sex")) : null; if (patch.sex !== "w") patch.cycle_on = false; }
  if (form.has("cycle_form")) {
    patch.cycle_on = form.get("cycle_on") === "on";
    patch.cycle_mode = ["natural", "hormonal", "none"].includes(String(form.get("cycle_mode"))) ? String(form.get("cycle_mode")) : "natural";
    const cl = Math.round(numOf(form.get("cycle_len")) || 28), pl = Math.round(numOf(form.get("period_len")) || 5);
    patch.cycle_len = Math.max(20, Math.min(45, cl)); patch.period_len = Math.max(2, Math.min(10, pl));
    patch.cycle_share = form.get("cycle_share") === "on"; patch.cycle_ai = form.get("cycle_ai") === "on";
  }
  if (form.has("weight_kg")) patch.weight_kg = numOf(form.get("weight_kg"));
  if (form.has("height_cm")) { const h = numOf(form.get("height_cm")); if (h != null && (h < 120 || h > 230)) return { error: "Grösse in cm, z. B. 182." }; patch.height_cm = h; }
  await repo.updateUser(subject.id, patch);
  revalidatePath("/", "layout");
  return { ok: "Profil gespeichert." };
}

export async function loadDemo() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await seedDemo(subject.id, Number(subject.weight_kg) || 80);
  revalidatePath("/", "layout");
}
export async function removeDemo() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await clearDemo(subject.id);
  revalidatePath("/", "layout");
}

export async function syncNow() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const r = await syncUser(subject.id);
  revalidatePath("/", "layout");
  return r;
}
export async function fullResync() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await syncUser(subject.id, { full: true });
  revalidatePath("/", "layout");
}
export async function disconnect(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await repo.removeConnection(subject.id, String(form.get("provider")));
  revalidatePath("/quellen");
}

export async function connectIntervals(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (viewer.id !== subject.id) return { error: "Verbinden kann nur die Person selbst." };
  const key = String(form.get("key") || "").trim();
  const athlete = String(form.get("athlete") || "").trim() || "0";
  if (key.length < 10) return { error: "Bitte den API-Schlüssel aus intervals.icu einfügen." };
  let info;
  try { info = await intervals.verify(athlete, key); } catch (e) { return { error: String(e.message || e) }; }
  const conn = await repo.saveConnection(subject.id, "intervals", { external_id: info.external_id, access_token: encrypt(key), status: "active", last_error: null });
  const r = await syncConnection({ ...conn, user_id: subject.id }, { full: true });
  revalidatePath("/", "layout");
  return r.ok ? { ok: `Verbunden${info.name ? ` als ${info.name}` : ""}. ${r.items} Datensätze der letzten 12 Monate geladen.` } : { error: `Verbunden, aber der erste Abruf schlug fehl: ${r.message}` };
}

const KINDS = ["body_photo", "meal", "inbody", "test", "blood", "other"];
export async function uploadMedia(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!filesReady) return { error: "Dateispeicher ist nicht verbunden." };
  const files = form.getAll("file").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!files.length) return { error: "Bitte eine Datei wählen." };
  const chosen = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : "auto";
  const day = dayOf(form.get("day"));
  const note = String(form.get("note") || "").slice(0, 200);
  const ai = await aiReady();
  const notes = [], found = {};
  for (const f of files.slice(0, 6)) {
    if (f.size > 4 * 1024 * 1024) return { error: `${f.name} ist grösser als 4 MB.` };
    if (!/^(image\/|application\/pdf)/.test(f.type)) return { error: `${f.name}: nur Bilder oder PDF.` };
    const buf = Buffer.from(await f.arrayBuffer());
    // Art: gewählt oder automatisch erkannt (KI), sonst Bild = Körperfoto, PDF = Dokument
    let kind = chosen, pose = ["front", "side", "back"].includes(String(form.get("pose"))) ? String(form.get("pose")) : null;
    if (kind === "auto") {
      kind = f.type === "application/pdf" ? "other" : "body_photo";
      if (ai && AI_IMAGE_TYPES.includes(f.type)) { try { const c = await classifyUpload(buf, f.type, subject.id); kind = c.art; pose = pose || c.pose; } catch {} }
    }
    if (kind !== "body_photo") pose = null;
    found[kind] = (found[kind] || 0) + 1;
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `files/${subject.id}/${kind}/${day}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const b = await putFile(path, buf, f.type);
    const m = await repo.addMedia(subject.id, { kind, day, pathname: b.pathname, content_type: f.type, size_bytes: f.size, note: note || null, pose });
    if (kind === "inbody" && ai) {
      try { const r = await applyInBody(subject.id, m, buf, viewer.id); notes.push(`${Object.keys(r.values).length} InBody-Werte ausgelesen (Messung vom ${r.day.split("-").reverse().join(".")})`); }
      catch (e) { await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) }); notes.push(`Auslesen fehlgeschlagen: ${String(e.message || e).slice(0, 160)}`); }
    }
    if (kind === "test" && ai) {
      try { const r = await applyTest(subject.id, m, buf, viewer.id); notes.push(`Test vom ${r.day.split("-").reverse().join(".")} übernommen: ${r.tests.map((t) => `${TEST_TYPES[t.test].name} ${testText(t.test, t.value, t)}`).join(", ")}${r.hinweis ? ` (${r.hinweis})` : ""}`); }
      catch (e) { await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) }); notes.push(`Auslesen fehlgeschlagen: ${String(e.message || e).slice(0, 160)}`); }
    }
  }
  // Neue Körperfotos oder InBody-Werte: Gesamtanalyse im Hintergrund (nach der Antwort)
  if ((found.body_photo || found.inbody) && ai) after(async () => { try { await runBodyAnalysis(subject.id); } catch {} });
  revalidatePath("/", "layout");
  const what = Object.entries(found).map(([k, n]) => `${n}× ${MEDIA_KINDS[k]}`).join(", ");
  return { ok: `Gespeichert: ${what}.${notes.length ? " " + notes.join(" · ") + "." : ""}${chosen === "auto" ? " Falsch erkannt? Bei der Datei die Art ändern." : ""}` };
}

// Körper-Gesamtanalyse auf Knopfdruck (alle Fotos, InBody, Gewicht)
export async function analyzeBodyAction(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet (Admin → Schnittstellen)." };
  try { await runBodyAnalysis(subject.id); }
  catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/", "layout");
  return { ok: "Analyse neu erstellt." };
}
// Vorgeschlagene Schwächen aus der Körperanalyse in die Ziele übernehmen (max. 4)
export async function adoptWeaknesses(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const add = String(form.get("weak") || "").split(",").filter((w) => WEAKNESSES[w]);
  if (!add.length) return { error: "Nichts zu übernehmen." };
  let out = [];
  await repo.updateGoals(subject.id, (g) => { out = [...new Set([...(g.weaknesses || []), ...add])].slice(0, 4); return { ...g, weaknesses: out, updated_at: new Date().toISOString() }; });
  revalidatePath("/", "layout");
  return { ok: `Übernommen – der Wochenplan berücksichtigt jetzt: ${out.map((w) => WEAKNESSES[w][0]).join(", ")}.` };
}

// Art oder Pose einer Datei korrigieren; wird sie zum InBody-Blatt, liest Formstand die Werte aus
export async function changeMedia(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const m = (await repo.getMedia(subject.id)).find((x) => x.id === String(form.get("id")));
  if (!m) return { error: "Datei nicht gefunden." };
  const kind = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : m.kind;
  const pose = kind === "body_photo" && ["front", "side", "back"].includes(String(form.get("pose"))) ? String(form.get("pose")) : null;
  await repo.updateMedia(subject.id, m.id, { kind, pose });
  let msg = "Geändert.";
  if ((m.kind === "inbody" || m.kind === "test") && kind !== m.kind) await repo.deleteManualBySource(subject.id, m.id);
  if (kind === "test" && m.kind !== "test" && (await aiReady())) {
    try { const buf = await readFile(m.pathname); const r = await applyTest(subject.id, { ...m, kind }, buf, viewer.id); msg = `Geändert – ${r.tests.length} Testwert${r.tests.length > 1 ? "e" : ""} übernommen.`; }
    catch (e) { await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) }); msg = `Geändert, aber Auslesen fehlgeschlagen: ${String(e.message || e).slice(0, 140)}`; }
  }
  if (kind === "inbody" && m.kind !== "inbody" && (await aiReady())) {
    try { const buf = await readFile(m.pathname); const r = await applyInBody(subject.id, { ...m, kind }, buf, viewer.id); msg = `Geändert – ${Object.keys(r.values).length} InBody-Werte ausgelesen.`; }
    catch (e) { await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) }); msg = `Geändert, aber Auslesen fehlgeschlagen: ${String(e.message || e).slice(0, 140)}`; }
  }
  revalidatePath("/", "layout");
  return { ok: msg };
}

// InBody-Datei (nochmals) auslesen, z. B. wenn sie vor der KI-Freischaltung hochgeladen wurde.
export async function rereadInBody(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet (Admin → Schnittstellen)." };
  const m = (await repo.getMedia(subject.id)).find((x) => x.id === String(form.get("id")));
  if (!m) return { error: "Datei nicht gefunden." };
  try {
    const buf = await readFile(m.pathname);
    if (!buf) throw new Error("Datei nicht lesbar.");
    const out = await applyInBody(subject.id, m, buf, viewer.id);
    revalidatePath("/", "layout");
    return { ok: `${Object.keys(out.values).length} Werte übernommen.` };
  } catch (e) {
    await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) });
    revalidatePath("/bilder");
    return { error: String(e.message || e).slice(0, 200) };
  }
}

// KI-Feedback zu einem Zeitraum (Woche, Monat, Gesamtbild)
export async function createFeedback(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet (Admin → Schnittstellen)." };
  try { await makeFeedback(subject.id, String(form.get("period") || "")); } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/heute");
  return { ok: "Feedback erstellt." };
}

// Wochenbrief der KI jetzt (neu) schreiben
export async function createBrief() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet (Admin → Schnittstellen)." };
  try { await makeBrief(subject.id); } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/heute");
  return { ok: "Wochenbrief geschrieben." };
}

// KI-Tagesempfehlung erstellen
export async function createAdvice() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  try { await makeAdvice(subject.id); } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/heute");
  return { ok: "Empfehlung erstellt." };
}

// Datei löschen – mit ausgelesenen Werten (InBody, Test)
async function dropMedia(userId, m) { try { await removeFile(m.pathname); } catch {} await repo.deleteMediaEntry(userId, m.id); await repo.deleteManualBySource(userId, m.id); }
export async function deleteMedia(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const m = (await repo.getMedia(subject.id)).find((x) => x.id === String(form.get("id")));
  if (m) await dropMedia(subject.id, m);
  revalidatePath("/", "layout");
}
// Alle Körperfotos und InBody-Blätter eines Tages löschen
export async function deleteMediaDay(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const day = String(form.get("day") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  for (const m of (await repo.getMedia(subject.id)).filter((x) => x.day === day && ["body_photo", "inbody"].includes(x.kind))) await dropMedia(subject.id, m);
  // InBody-Werte dieses Tages, auch wenn das Blatt an einem anderen Datum abgelegt ist
  for (const e of (await repo.getManual(subject.id)).filter((x) => x.kind === "inbody" && x.day === day)) await repo.deleteManual(subject.id, e.id);
  revalidatePath("/", "layout");
}

// ---------- Morgen-Check-in ----------
const scale = (v, a, b) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : null; };
export async function saveCheckin(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const data = {
    energy: scale(form.get("energy"), 1, 5), motivation: scale(form.get("motivation"), 1, 5), stress: scale(form.get("stress"), 1, 5),
    soreness: { legs: scale(form.get("sore_legs"), 0, 3) ?? 0, upper: scale(form.get("sore_upper"), 0, 3) ?? 0, core: scale(form.get("sore_core"), 0, 3) ?? 0 },
    time_min: scale(form.get("time_min"), 0, 600), note: String(form.get("note") || "").slice(0, 200) || null,
  };
  if (!data.energy || !data.motivation || !data.stress) return { error: "Bitte Energie, Motivation und Stress wählen." };
  await repo.setCheckin(subject.id, todayIso(), data, viewer.id);
  // Danach frische Daten holen und die Empfehlung mit dem Check-in neu schreiben
  after(async () => {
    try { await syncUser(subject.id); } catch {}
    try { if (await aiReady()) await makeAdvice(subject.id); } catch {}
  });
  revalidatePath("/", "layout");
  return { ok: "Danke! Bereitschaft und Empfehlung sind aktualisiert." };
}

// ---------- Gefühl nach der Einheit ----------
export async function rateSession(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const key = String(form.get("key") || "").slice(0, 200);
  const rpe = scale(form.get("rpe"), 1, 10);
  const region = ["legs", "upper", "full"].includes(String(form.get("region"))) ? String(form.get("region")) : null;
  if (!key || !rpe) return { error: "Bitte wählen, wie hart es war." };
  await repo.setFeel(subject.id, key, { rpe, region, day: dayOf(form.get("day")) });
  revalidatePath("/", "layout");
  return { ok: "Gespeichert." };
}

// ---------- Push ----------
export async function savePushSub(sub) {
  const { viewer, demo } = await ctx();
  if (demo) return DEMO;
  if (!sub?.endpoint || !sub?.keys?.p256dh) return { error: "Ungültiges Abo." };
  await repo.addPushSub(viewer.id, { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } });
  return { ok: true };
}
export async function deletePushSub(endpoint) {
  const { viewer } = await ctx();
  await repo.removePushSub(viewer.id, String(endpoint || ""));
  return { ok: true };
}
export async function testPush() {
  const { viewer, demo } = await ctx();
  if (demo) return DEMO;
  const n = await sendTo(viewer.id, { title: "Formstand", body: "So sieht die Morgen-Erinnerung aus.", url: "/heute#checkin", tag: "test" });
  return n ? { ok: "Testnachricht gesendet." } : { error: "Kein aktives Gerät gefunden." };
}

// ---------- Ziele, Schwächen, Wettkämpfe ----------
export async function saveGoals(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const weak = form.getAll("weak").map(String).filter((w) => WEAKNESSES[w]).slice(0, 4);
  const main = WEAKNESSES[String(form.get("mainWeakness"))] ? String(form.get("mainWeakness")) : weak[0] || null;
  await repo.updateGoals(subject.id, (g) => ({
    ...g, focus: FOCUS[String(form.get("focus"))] ? String(form.get("focus")) : g.focus,
    weaknesses: weak.filter((w) => w !== main), mainWeakness: main,
    daysPerWeek: scale(form.get("daysPerWeek"), 2, 7) ?? g.daysPerWeek, hoursPerWeek: Math.max(2, Math.min(25, numOf(form.get("hoursPerWeek")) ?? g.hoursPerWeek)),
    longDay: scale(form.get("longDay"), 0, 6) ?? g.longDay, note: String(form.get("note") || "").slice(0, 500), updated_at: new Date().toISOString(),
    targetWeight: (() => { const v = numOf(form.get("targetWeight")); return v && v >= 35 && v <= 200 ? v : null; })(),
    targetBodyfat: (() => { const v = numOf(form.get("targetBodyfat")); return v && v >= 4 && v <= 45 ? v : null; })(),
    rate: [0.25, 0.5, 0.75, 1].includes(numOf(form.get("rate"))) ? numOf(form.get("rate")) : g.rate,
    swimsPerWeek: scale(form.get("swimsPerWeek"), 1, 6),
  }));
  revalidatePath("/", "layout");
  return { ok: "Gespeichert. Plan und Tagesentscheidung sind angepasst." };
}
// ---------- Messbare Ziele ----------
export async function addTarget(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const metric = String(form.get("metric") || "");
  const M = TARGET_METRICS[metric];
  if (!M) return { error: "Bitte wählen, was du verbessern willst." };
  const today = todayIso();
  const by = String(form.get("by") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(by) || by <= today) return { error: "Bitte ein Zieldatum in der Zukunft wählen." };
  const note = String(form.get("note") || "").slice(0, 200) || null;
  const t = { id: crypto.randomBytes(6).toString("hex"), metric, by, startDay: today, note, created_at: new Date().toISOString() };
  if (metric === "free") {
    t.label = String(form.get("label") || "").slice(0, 80);
    if (!t.label) return { error: "Bitte das Ziel kurz beschreiben." };
  } else {
    const parse = (v) => (M.time ? timeOf(v) : numOf(v));
    t.target = parse(form.get("target"));
    if (t.target == null || t.target <= 0) return { error: M.time ? "Zielzeit als m:ss eingeben, z. B. 21:30." : "Bitte einen Zielwert eingeben." };
    const [manual, series] = await Promise.all([repo.getManual(subject.id), buildSeries(subject.id, addDays(today, -120), today)]);
    const s = seriesOf(metric, manual, series.all);
    const startIn = parse(form.get("start"));
    t.start = startIn ?? (metric === "weight" && s.length ? Math.round((s.slice(-7).reduce((a, x) => a + x.v, 0) / Math.min(7, s.length)) * 10) / 10 : s.at(-1)?.v ?? null);
    if (t.start == null) return { error: `Für ${M.name} gibt es noch keinen Messwert – bitte den aktuellen Wert als Startwert eintragen${metric.startsWith("t:") ? " oder zuerst den Test machen" : ""}.` };
    if (t.start === t.target) return { error: "Zielwert und Startwert sind gleich." };
  }
  const warn = t.metric === "free" ? null : ambition(metric, t.start, t.target, today, by).warn;
  const current = { weight: Number(subject.weight_kg) || null };
  let fx;
  await repo.updateGoals(subject.id, (g) => {
    const targets = [...(g.targets || []), t].slice(-6);
    fx = goalEffects(targets, current);
    // Ziele steuern Fokus und Ernährung: Abnehmziel → Abnehmen mit passendem Tempo; neutraler Fokus wird übersteuert
    const focus = fx.focus && (!g.focus || ["maintain", "health", "performance"].includes(g.focus) || fx.focus === "cut") ? fx.focus : g.focus;
    return { ...g, targets, focus, ...(fx.targetWeight ? { targetWeight: fx.targetWeight } : {}), ...(fx.targetBodyfat ? { targetBodyfat: fx.targetBodyfat } : {}), ...(fx.rate ? { rate: fx.rate } : {}), updated_at: new Date().toISOString() };
  });
  revalidatePath("/", "layout");
  const own = goalEffects([t], current);
  const eff = [own.focus === "cut" && fx.rate ? `Ernährung auf ${String(fx.rate).replace(".", ",")} % Gewichtsverlust pro Woche eingestellt` : own.focus === "muscle" ? "Fokus auf Muskelaufbau gestellt" : null, M.area && WEAKNESSES[M.area] ? `Wochenplan setzt Fokus-Einheiten für ${WEAKNESSES[M.area][0]}` : null].filter(Boolean);
  return { ok: `Ziel gespeichert.${eff.length ? " " + eff.join(" · ") + "." : ""}${warn ? " Achtung: " + warn : ""}` };
}
export async function deleteTarget(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const id = String(form.get("id"));
  await repo.updateGoals(subject.id, (g) => ({ ...g, targets: (g.targets || []).filter((t) => t.id !== id), updated_at: new Date().toISOString() }));
  revalidatePath("/", "layout");
}

export async function addEvent(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const name = String(form.get("name") || "").trim().slice(0, 80), date = String(form.get("date") || "");
  if (!name) return { error: "Gib dem Wettkampf einen Namen." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Datum wählen." };
  if (date < todayIso()) return { error: "Das Datum liegt in der Vergangenheit." };
  const type = EVENT_TYPES[String(form.get("type"))] ? String(form.get("type")) : "sonst";
  const priority = ["A", "B", "C"].includes(String(form.get("priority"))) ? String(form.get("priority")) : "B";
  const txt = (k, n) => String(form.get(k) || "").trim().slice(0, n) || null;
  let points = [];
  try { points = JSON.parse(String(form.get("points") || "[]")).filter((x) => typeof x === "string").slice(0, 4).map((x) => x.slice(0, 120)); } catch {}
  const addWeak = form.get("takeWeak") === "1" ? String(form.get("weak") || "").split(",").filter((w) => WEAKNESSES[w]) : [];
  const ev = { id: crypto.randomUUID(), name, date, type, priority, target: txt("target", 120), variant: txt("variant", 60), info: txt("info", 300), place: txt("place", 80), url: /^https?:\/\//.test(String(form.get("url") || "")) ? txt("url", 300) : null, points };
  await repo.updateGoals(subject.id, (g) => {
    const weaknesses = [...new Set([...(g.weaknesses || []), ...addWeak])].slice(0, 4);
    return { ...g, events: [...(g.events || []), ev].sort((a, b) => (a.date < b.date ? -1 : 1)), weaknesses, updated_at: new Date().toISOString() };
  });
  revalidatePath("/", "layout");
  return { ok: `${name} eingetragen.` };
}

// Wettkampf per KI im Web suchen und einordnen (nur auf Knopfdruck)
export async function findEvent(query) {
  const { subject, demo } = await ctx();
  if (demo) return { error: "In der Demo ist die Suche ausgeschaltet." };
  const q = String(query || "").trim().slice(0, 120);
  if (q.length < 3) return { error: "Mindestens 3 Zeichen eingeben." };
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet – trag den Wettkampf einfach unten ein." };
  try {
    const r = await aiFindEvent(q, { types: Object.keys(EVENT_TYPES).join(", "), weaknesses: Object.keys(WEAKNESSES).join(", "), today: todayIso() }, subject.id);
    const variants = Array.isArray(r.varianten) ? r.varianten.filter((v) => v && v.name).slice(0, 6).map((v) => ({ name: String(v.name).slice(0, 60), text: String(v.beschreibung || "").slice(0, 200) })) : [];
    return { result: {
      found: r.gefunden !== false, name: String(r.name || q).slice(0, 80), place: r.ort ? String(r.ort).slice(0, 80) : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.datum || "") && r.datum >= todayIso() ? r.datum : null, dateSure: Boolean(r.datum_sicher),
      type: EVENT_TYPES[r.typ] ? r.typ : "sonst", info: r.beschreibung ? String(r.beschreibung).slice(0, 300) : null,
      variants, question: r.frage ? String(r.frage).slice(0, 200) : null,
      points: Array.isArray(r.schwerpunkte) ? r.schwerpunkte.filter((x) => typeof x === "string").slice(0, 4).map((x) => x.slice(0, 120)) : [],
      weak: Array.isArray(r.schwaechen) ? r.schwaechen.filter((w) => WEAKNESSES[w]).slice(0, 4) : [],
      url: /^https?:\/\//.test(r.url || "") ? String(r.url).slice(0, 300) : null, searched: r.searched,
    } };
  } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
}
export async function deleteEvent(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const id = String(form.get("id"));
  await repo.updateGoals(subject.id, (g) => ({ ...g, events: (g.events || []).filter((e) => e.id !== id) }));
  revalidatePath("/", "layout");
}

// ---------- Körperfotos mit KI vergleichen (nur auf Knopfdruck) ----------
const readBlob = async (pathname) => {
  const buf = await readFile(pathname);
  if (!buf) throw new Error("Foto nicht lesbar.");
  return buf;
};
export async function comparePhotos(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!(await aiReady())) return { error: "KI ist nicht freigeschaltet (Admin → Schnittstellen)." };
  const media = await repo.getMedia(subject.id);
  const A = media.find((x) => x.id === String(form.get("a"))), B = media.find((x) => x.id === String(form.get("b")));
  if (!A || !B || A.id === B.id) return { error: "Bitte zwei verschiedene Fotos wählen." };
  const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ok.includes(A.content_type) || !ok.includes(B.content_type)) return { error: "Nur JPG, PNG oder WebP vergleichbar (kein HEIC)." };
  // Gemessene Referenzen zu beiden Daten: nächstes Gewicht und InBody/Körperfett
  const man = await repo.getManual(subject.id);
  const near = (kind, day) => man.filter((x) => x.kind === kind).map((x) => [Math.abs(new Date(x.day) - new Date(day)) / 864e5, x]).filter(([d]) => d <= 21).sort((p, q) => p[0] - q[0])[0]?.[1];
  const ref = (day) => ({ datum: day, gewicht_kg: near("weight", day)?.value ?? null, koerperfett_pct: near("bodyfat", day)?.value ?? null, inbody: near("inbody", day)?.data ? { skelettmuskel_kg: near("inbody", day).data.smm_kg ?? null, fettmasse_kg: near("inbody", day).data.fat_mass_kg ?? null } : null });
  try {
    const r = await aiComparePhotos({ buf: await readBlob(A.pathname), type: A.content_type }, { buf: await readBlob(B.pathname), type: B.content_type },
      { A: ref(A.day), B: ref(B.day), tage_dazwischen: Math.round((new Date(B.day) - new Date(A.day)) / 864e5), pose: B.pose || A.pose || null }, subject.id);
    await repo.savePhotoCompare(subject.id, `${A.id}|${B.id}`, r);
  } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/bilder");
  return { ok: "Vergleich erstellt." };
}

// ---------- Wochenplan anpassen ----------
const PLAN_TYPES = ["quality", "easy", "long", "strength"];
export async function savePlanDay(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const date = String(form.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tag wählen." };
  const mode = String(form.get("mode") || "plan");
  if (mode === "swap") return swapDays(subject.id, date, String(form.get("with") || ""));
  const repeat = form.get("repeat") === "1";
  const dow = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
  const min = scale(form.get(mode === "session" ? "dur" : "min"), 10, 600);
  let entry = null;
  if (mode === "off") entry = { kind: "off", note: String(form.get("note") || "").slice(0, 120) || null };
  else if (mode === "max") { if (!min) return { error: "Wie viele Minuten hast du?" }; entry = { kind: "max", min }; }
  else if (mode === "session") {
    const type = PLAN_TYPES.includes(String(form.get("type"))) ? String(form.get("type")) : "easy";
    const title = String(form.get("title") || "").trim().slice(0, 60);
    if (!title) return { error: "Gib dem Training einen Namen, z. B. „Ausfahrt mit Buddy“." };
    entry = { kind: "session", type, sport: ["bike", "run", "swim", "strength", "hyrox", "other"].includes(String(form.get("sport"))) ? String(form.get("sport")) : null, title, min: min || 60, note: String(form.get("note") || "").slice(0, 160) || null };
  }
  const cutoff = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const g0 = await repo.getGoals(subject.id);
  const frozen = pastOf(await planItems(subject.id, g0, date), g0);
  await repo.updateGoals(subject.id, (g) => {
    const overrides = { ...frozen, ...Object.fromEntries(Object.entries(g.overrides || {}).filter(([d]) => d >= cutoff)) };
    let fixed = [...(g.fixed || [])];
    if (!entry) {
      delete overrides[date];
      // Fester Termin an diesem Wochentag: nur diese Woche aussetzen
      if (fixed.some((f) => Number(f.dow) === dow)) overrides[date] = { kind: "plan" };
    } else if (repeat) {
      fixed = [...fixed.filter((f) => Number(f.dow) !== dow), { id: crypto.randomUUID(), dow, ...entry }];
      delete overrides[date];
    } else overrides[date] = entry;
    return { ...g, overrides, fixed, updated_at: g.updated_at || new Date().toISOString() };
  });
  revalidatePath("/", "layout");
  return { ok: entry ? (repeat ? "Gespeichert – gilt ab jetzt jede Woche." : "Gespeichert – der Rest der Woche ist neu verteilt.") : "Zurück auf den Vorschlag." };
}
// Plan-Eintrag als eigener Eintrag (für Tausch und zum Einfrieren vergangener Tage)
const asEntry = (it, extra = {}) => (it.type === "rest" || !it.min
  ? { kind: "off", title: it.title, note: it.detail || null, ...extra }
  : { kind: "session", type: ["quality", "long", "strength"].includes(it.type) ? it.type : "easy", sport: it.sport || (it.type === "strength" ? "strength" : null), title: it.title, min: it.min, note: String(it.detail || "").slice(0, 400) || null, ...(extra.frozen && it.second ? { second: it.second } : {}), ...(extra.frozen && it.focus ? { focus: it.focus } : {}), ...extra });
// Vergangene Tage der Woche festhalten, damit eine Änderung sie nicht nachträglich umplant
const pastOf = (items, goals) => Object.fromEntries(items.filter((x) => x.day < todayIso() && !goals.overrides?.[x.day] && x.type !== "race").map((x) => [x.day, asEntry(x, { frozen: true })]));
async function planItems(userId, goals, date) {
  const user = await repo.getUser(userId);
  return weekPlan(goals, mondayOf(date), user || {}, await athleteZones(userId)).items;
}

// Zwei Tage tauschen: beide werden zu eigenen Einträgen mit dem Inhalt des anderen Tages
async function swapDays(userId, a, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || a === b) return { error: "Tag zum Tauschen wählen." };
  if (a < todayIso() || b < todayIso()) return { error: "Nur heute und kommende Tage lassen sich tauschen." };
  const [goals, user] = await Promise.all([repo.getGoals(userId), repo.getUser(userId)]);
  const zones = await athleteZones(userId);
  const items = [...weekPlan(goals, mondayOf(a), user || {}, zones).items, ...(mondayOf(a) === mondayOf(b) ? [] : weekPlan(goals, mondayOf(b), user || {}, zones).items)];
  const A = items.find((x) => x.day === a), B = items.find((x) => x.day === b);
  if (!A || !B) return { error: "Tag nicht im Plan gefunden." };
  if (A.type === "race" || B.type === "race") return { error: "Wettkampftage lassen sich nicht tauschen." };
  const entry = (it) => (it.type === "rest" || !it.min ? { kind: "off", title: "Ruhetag (getauscht)", note: "Mit einem anderen Tag getauscht." } : asEntry(it));
  const frozen = pastOf(items, goals);
  await repo.updateGoals(userId, (g) => ({ ...g, overrides: { ...frozen, ...(g.overrides || {}), [a]: entry(B), [b]: entry(A) }, updated_at: g.updated_at || new Date().toISOString() }));
  revalidatePath("/", "layout");
  return { ok: "Getauscht." };
}
export async function deleteFixed(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const id = String(form.get("id"));
  await repo.updateGoals(subject.id, (g) => ({ ...g, fixed: (g.fixed || []).filter((f) => f.id !== id) }));
  revalidatePath("/", "layout");
}

// ---------- Training nachtragen (ohne Uhr) ----------
const SPORT_MAP = { bike: ["Ride", "end"], run: ["Run", "end"], swim: ["Swim", "end"], strength: ["WeightTraining", "str"], hike: ["Hike", "other"], other: ["Workout", "end"] };
export async function addWorkout(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const day = dayOf(form.get("day"));
  const sp = SPORT_MAP[String(form.get("sport"))] ? String(form.get("sport")) : "other";
  const min = scale(form.get("min"), 5, 900), rpe = scale(form.get("rpe"), 1, 10);
  if (!min || !rpe) return { error: "Dauer und Anstrengung angeben." };
  const [sport, category] = SPORT_MAP[sp];
  const id = crypto.randomUUID();
  const load = category === "other" ? Math.round(min / 3) : Math.round((min / 60) * 100 * (rpe / 8) ** 2 * (category === "str" ? 0.8 : 1));
  await repo.upsertActivities(subject.id, [{ provider: "manual", external_id: id, start_time: `${day}T10:00:00.000Z`, day, sport, category, name: String(form.get("title") || "").trim().slice(0, 60) || ({ bike: "Rad", run: "Lauf", swim: "Schwimmen", strength: "Kraft", hike: "Wandern", other: "Training" })[sp], duration_s: min * 60, has_power: false, load }]);
  const region = ["legs", "upper", "full"].includes(String(form.get("region"))) ? String(form.get("region")) : null;
  await repo.setFeel(subject.id, `manual|${id}`, { rpe, region: category === "str" ? region || "full" : null, day });
  revalidatePath("/", "layout");
  return { ok: "Training eingetragen." };
}
export async function deleteWorkout(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  await repo.deleteActivity(subject.id, "manual", String(form.get("id")));
  revalidatePath("/", "layout");
}
