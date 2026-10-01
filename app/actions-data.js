"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { put, del, get } from "@vercel/blob";
import crypto from "node:crypto";
import * as repo from "@/lib/repo";
import { viewerAndSubject } from "@/lib/subject";
import { seedDemo, clearDemo } from "@/lib/demo";
import { syncUser, syncConnection } from "@/lib/sync";
import { todayIso } from "@/lib/metrics";
import { encrypt } from "@/lib/crypto";
import { intervals } from "@/lib/providers/intervals";
import { aiReady } from "@/lib/ai";
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Dateispeicher ist nicht verbunden." };
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
    const b = await put(path, buf, { access: "private", contentType: f.type });
    const m = await repo.addMedia(subject.id, { kind, day, pathname: b.pathname, content_type: f.type, size_bytes: f.size, note: note || null });
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
    const r = await get(m.pathname, { access: "private" });
    if (!r || r.statusCode !== 200) throw new Error("Datei nicht lesbar.");
    const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
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
  if (m) { try { await del(m.pathname); } catch {} await repo.deleteMediaEntry(subject.id, m.id); await repo.deleteManualBySource(subject.id, m.id); }
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
  }));
  revalidatePath("/", "layout");
  return { ok: "Gespeichert. Plan und Tagesentscheidung sind angepasst." };
}
export async function addEvent(_prev, form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const name = String(form.get("name") || "").trim().slice(0, 80), date = String(form.get("date") || "");
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Name und Datum angeben." };
  if (date < todayIso()) return { error: "Das Datum liegt in der Vergangenheit." };
  const type = EVENT_TYPES[String(form.get("type"))] ? String(form.get("type")) : "sonst";
  const priority = ["A", "B", "C"].includes(String(form.get("priority"))) ? String(form.get("priority")) : "B";
  await repo.updateGoals(subject.id, (g) => ({ ...g, events: [...(g.events || []), { id: crypto.randomUUID(), name, date, type, priority, target: String(form.get("target") || "").slice(0, 120) || null }].sort((a, b) => (a.date < b.date ? -1 : 1)), updated_at: new Date().toISOString() }));
  revalidatePath("/", "layout");
  return { ok: `${name} eingetragen.` };
}
export async function deleteEvent(form) {
  const { subject, demo } = await ctx();
  if (demo) return DEMO;
  const id = String(form.get("id"));
  await repo.updateGoals(subject.id, (g) => ({ ...g, events: (g.events || []).filter((e) => e.id !== id) }));
  revalidatePath("/", "layout");
}
