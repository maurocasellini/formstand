// InBody-Blatt (PDF oder Foto) auslesen und als Eingaben ablegen.
// Die Werte hängen an der Datei: wird sie gelöscht oder neu ausgelesen, verschwinden die alten Einträge.
import * as repo from "./repo";
import { readInBody, INBODY_FIELDS } from "./ai";

export const AI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export async function applyInBody(userId, media, buffer, viewerId) {
  if (!AI_IMAGE_TYPES.includes(media.content_type)) throw new Error("Format nicht lesbar. Bitte PDF, JPG oder PNG.");
  const d = await readInBody(buffer, media.content_type);
  const values = Object.fromEntries(Object.keys(INBODY_FIELDS).map((k) => [k, d[k]]).filter(([, v]) => v != null));
  if (!Object.keys(values).length) throw new Error("Auf dem Blatt wurden keine Messwerte gefunden.");
  const day = d.date || media.day;
  const base = { day, source_media: media.id, created_by: viewerId };
  await repo.deleteManualBySource(userId, media.id);
  const entries = [{ ...base, kind: "inbody", value: values.inbody_score ?? values.smm_kg ?? null, data: { ...values, segments: d.segments || null, device: d.device || null, notes: d.notes || null } }];
  if (values.weight_kg) entries.push({ ...base, kind: "weight", value: values.weight_kg, data: {} });
  if (values.body_fat_pct) entries.push({ ...base, kind: "bodyfat", value: values.body_fat_pct, data: {} });
  await repo.addManualMany(userId, entries);
  if (values.weight_kg) {
    const newer = (await repo.getManual(userId)).some((m) => m.kind === "weight" && m.day > day);
    if (!newer) await repo.updateUser(userId, { weight_kg: values.weight_kg });
  }
  await repo.updateMedia(userId, media.id, { extracted: { ...values, date: day, device: d.device || null, notes: d.notes || null, model: d.model }, extract_error: null });
  return { day, values };
}
