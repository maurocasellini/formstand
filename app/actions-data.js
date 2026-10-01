"use server";
import { revalidatePath } from "next/cache";
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
