import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { currentUser, resolveSubject } from "@/lib/auth";
import { q } from "@/lib/db";
import { storeBatch } from "@/lib/sync";
import { mapFile, mergeDaily } from "@/lib/garmin-export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Nimmt einen Teil eines Garmin-Exports entgegen (im Browser entpackt): { file, records: [...] }
export async function POST(req) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const subject = await resolveSubject(viewer, (await cookies()).get("fs_subject")?.value);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.file !== "string" || !Array.isArray(body.records)) return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  const file = body.file.slice(0, 300);
  const { kind, daily, activities } = mapFile(file, body.records);
  const base = file.split("/").pop().replace(/\.json$/i, "").replace(/[0-9a-f-]{8,}|\d{4,}/gi, "#").slice(0, 80);
  const raw = body.records.slice(0, 5000).map((r, i) => {
    const id = r?.activityId ?? r?.calendarDate ?? r?.calendarDateStr ?? null;
    const ext = id != null ? String(id) : crypto.createHash("sha1").update(file + ":" + (body.offset || 0) + ":" + i).digest("hex").slice(0, 16);
    return { kind: `export:${base}`, external_id: ext, payload: r };
  });
  await storeBatch(subject.id, "garmin_export", { raw });
  await storeBatch(subject.id, "garmin", { daily: mergeDaily(daily), activities });
  if (body.last) await q("insert into sync_runs (user_id, provider, ok, items, message) values ($1,'garmin_export',true,$2,$3)", [subject.id, body.total || 0, "Garmin-Export importiert"]);
  return NextResponse.json({ kind, daily: daily.length, activities: activities.length, raw: raw.length });
}
