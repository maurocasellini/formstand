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
import { todayIso } from "@/lib/metrics";
import { encrypt } from "@/lib/crypto";
import { intervals } from "@/lib/providers/intervals";
import { aiReady, comparePhotos as aiComparePhotos, findEvent as aiFindEvent } from "@/lib/ai";
import { applyInBody } from "@/lib/inbody";
import { makeAdvice } from "@/lib/coach";
import { sendTo } from "@/lib/push";
import { WEAKNESSES, EVENT_TYPES, FOCUS } from "@/lib/catalog";

async function ctx() {
  const { viewer, subject } = await viewerAndSubject();
  return { viewer, subject, demo: viewer.demo };
}
const DEMO = { error: "In der Demo kann man nur schauen. Mit eigenem Konto geht alles." };
const dayOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : todayIso());
const numOf = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };

export async function addManual(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  const kind = String(form.get("kind"));
  const day = dayOf(form.get("day"));
  const value = numOf(form.get("value"));
  const data = {};
  if (kind === "trigger") data.t = String(form.get("t") || "alkohol").slice(0, 40);
  if (kind === "test") { data.test = String(form.get("test") || "ramp"); data.note = String(form.get("note") || "").slice(0, 80); }
  if (kind === "note") data.text = String(form.get("text") || "").slice(0, 500);
  if (!["weight", "bodyfat", "trigger", "test", "note"].includes(kind)) return { error: "Unbekannte Eingabe." };
  if (kind !== "note" && kind !== "trigger" && (value == null || value <= 0)) return { error: "Bitte einen gültigen Wert eingeben." };
  await repo.addManual(subject.id, { day, kind, value: kind === "trigger" ? (value || 1) : value, data, created_by: viewer.id });
  if (kind === "weight") await repo.updateUser(subject.id, { weight_kg: value });
  revalidatePath("/", "layout");
  return { ok: "Gespeichert." };
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
  await repo.updateUser(subject.id, { sport: String(form.get("sport") || "").slice(0, 40) || null, weight_kg: numOf(form.get("weight_kg")), birth_year: numOf(form.get("birth_year")) });
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

const KINDS = ["body_photo", "meal", "inbody", "blood", "other"];
export async function uploadMedia(_prev, form) {
  const { viewer, subject, demo } = await ctx();
  if (demo) return DEMO;
  if (!filesReady) return { error: "Dateispeicher ist nicht verbunden." };
  const files = form.getAll("file").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!files.length) return { error: "Bitte eine Datei wählen." };
  const kind = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : "other";
  const day = dayOf(form.get("day"));
  const note = String(form.get("note") || "").slice(0, 200);
  const ai = kind === "inbody" && (await aiReady());
  const notes = [];
  for (const f of files.slice(0, 6)) {
    if (f.size > 4 * 1024 * 1024) return { error: `${f.name} ist grösser als 4 MB.` };
    if (!/^(image\/|application\/pdf)/.test(f.type)) return { error: `${f.name}: nur Bilder oder PDF.` };
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `files/${subject.id}/${kind}/${day}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const b = await putFile(path, buf, f.type);
    const pose = kind === "body_photo" && ["front", "side", "back"].includes(String(form.get("pose"))) ? String(form.get("pose")) : null;
    const m = await repo.addMedia(subject.id, { kind, day, pathname: b.pathname, content_type: f.type, size_bytes: f.size, note: note || null, pose });
    if (ai) {
      try { const r = await applyInBody(subject.id, m, buf, viewer.id); notes.push(`${Object.keys(r.values).length} Werte ausgelesen (Messung vom ${r.day.split("-").reverse().join(".")})`); }
      catch (e) { await repo.updateMedia(subject.id, m.id, { extract_error: String(e.message || e).slice(0, 200) }); notes.push(`Auslesen fehlgeschlagen: ${String(e.message || e).slice(0, 160)}`); }
    }
  }
  revalidatePath("/", "layout");
  return { ok: `${files.length} Datei${files.length > 1 ? "en" : ""} gespeichert.${notes.length ? " " + notes.join(" · ") + "." : ""}` };
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

// KI-Tagesempfehlung erstellen
export async function createAdvice() {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  try { await makeAdvice(subject.id); } catch (e) { return { error: String(e.message || e).slice(0, 240) }; }
  revalidatePath("/heute");
  return { ok: "Empfehlung erstellt." };
}

export async function deleteMedia(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const m = (await repo.getMedia(subject.id)).find((x) => x.id === String(form.get("id")));
  if (m) { try { await removeFile(m.pathname); } catch {} await repo.deleteMediaEntry(subject.id, m.id); await repo.deleteManualBySource(subject.id, m.id); }
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
  return { ok: "Danke! Tagesform und Empfehlung sind aktualisiert." };
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
