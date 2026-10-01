"use server";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import crypto from "node:crypto";
import { q, one } from "@/lib/db";
import { viewerAndSubject } from "@/lib/subject";
import { seedDemo, clearDemo } from "@/lib/demo";
import { syncUser } from "@/lib/sync";
import { todayIso } from "@/lib/metrics";

async function ctx() {
  const { viewer, subject } = await viewerAndSubject();
  return { viewer, subject };
}
const dayOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : todayIso());
const numOf = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

export async function addManual(_prev, form) {
  const { viewer, subject } = await ctx();
  const kind = String(form.get("kind"));
  const day = dayOf(form.get("day"));
  const value = numOf(form.get("value"));
  const data = {};
  if (kind === "trigger") { data.t = String(form.get("t") || "alkohol").slice(0, 40); }
  if (kind === "test") { data.test = String(form.get("test") || "ramp"); data.note = String(form.get("note") || "").slice(0, 80); }
  if (kind === "note") { data.text = String(form.get("text") || "").slice(0, 500); }
  if (!["weight", "bodyfat", "trigger", "test", "note"].includes(kind)) return { error: "Unbekannte Eingabe." };
  if (kind !== "note" && kind !== "trigger" && (value == null || value <= 0)) return { error: "Bitte einen gültigen Wert eingeben." };
  await q("insert into manual_entries (user_id, day, kind, value, data, created_by) values ($1,$2,$3,$4,$5,$6)",
    [subject.id, day, kind, kind === "trigger" ? (value || 1) : value, JSON.stringify(data), viewer.id]);
  if (kind === "weight") await q("update users set weight_kg=$1 where id=$2", [value, subject.id]);
  revalidatePath("/", "layout");
  return { ok: "Gespeichert." };
}

export async function deleteManual(form) {
  const { subject } = await ctx();
  await q("delete from manual_entries where id=$1 and user_id=$2", [Number(form.get("id")), subject.id]);
  revalidatePath("/", "layout");
}

export async function updateProfile(_prev, form) {
  const { subject } = await ctx();
  await q("update users set sport=$1, weight_kg=$2, birth_year=$3 where id=$4",
    [String(form.get("sport") || "").slice(0, 40) || null, numOf(form.get("weight_kg")), numOf(form.get("birth_year")), subject.id]);
  revalidatePath("/", "layout");
  return { ok: "Profil gespeichert." };
}

export async function loadDemo() {
  const { subject } = await ctx();
  await seedDemo(subject.id, Number(subject.weight_kg) || 80);
  revalidatePath("/", "layout");
}
export async function removeDemo() {
  const { subject } = await ctx();
  await clearDemo(subject.id);
  revalidatePath("/", "layout");
}

export async function syncNow() {
  const { subject } = await ctx();
  const r = await syncUser(subject.id);
  revalidatePath("/", "layout");
  return r;
}
export async function fullResync() {
  const { subject } = await ctx();
  await syncUser(subject.id, { full: true });
  revalidatePath("/", "layout");
}
export async function disconnect(form) {
  const { subject } = await ctx();
  await q("delete from connections where user_id=$1 and provider=$2", [subject.id, String(form.get("provider"))]);
  revalidatePath("/quellen");
}

const KINDS = ["body_photo", "meal", "inbody", "blood", "other"];
export async function uploadMedia(_prev, form) {
  const { subject } = await ctx();
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { error: "Dateispeicher ist noch nicht verbunden (Vercel Blob)." };
  const files = form.getAll("file").filter((f) => f && typeof f === "object" && f.size > 0);
  if (!files.length) return { error: "Bitte eine Datei wählen." };
  const kind = KINDS.includes(String(form.get("kind"))) ? String(form.get("kind")) : "other";
  const day = dayOf(form.get("day"));
  const note = String(form.get("note") || "").slice(0, 200);
  for (const f of files.slice(0, 6)) {
    if (f.size > 10 * 1024 * 1024) return { error: `${f.name} ist grösser als 10 MB.` };
    if (!/^(image\/|application\/pdf)/.test(f.type)) return { error: `${f.name}: nur Bilder oder PDF.` };
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `users/${subject.id}/${kind}/${day}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const b = await put(path, f, { access: "private", contentType: f.type });
    await q("insert into media (user_id, kind, day, pathname, content_type, size_bytes, note) values ($1,$2,$3,$4,$5,$6,$7)",
      [subject.id, kind, day, b.pathname, f.type, f.size, note || null]);
  }
  revalidatePath("/bilder");
  return { ok: `${files.length} Datei${files.length > 1 ? "en" : ""} gespeichert.` };
}

export async function deleteMedia(form) {
  const { subject } = await ctx();
  const m = await one("select id, pathname from media where id=$1 and user_id=$2", [String(form.get("id")), subject.id]);
  if (m) { try { await del(m.pathname); } catch {} await q("delete from media where id=$1", [m.id]); }
  revalidatePath("/bilder");
}
