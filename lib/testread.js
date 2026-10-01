// Leistungstest aus Screenshot/PDF übernehmen: Werte auslesen, prüfen, als Testeinträge ablegen (an die Datei gebunden).
import * as repo from "./repo";
import { readTestSheet } from "./ai";
import { TEST_TYPES, TEST_RANGE as RANGE, TEST_DURATIONS } from "./catalog";

export async function applyTest(userId, media, buffer, viewerId) {
  const types = Object.entries(TEST_TYPES).map(([k, t]) => `- ${k}: ${t.name} – ${t.label}`).join("\n");
  const r = await readTestSheet(buffer, media.content_type, types, userId);
  const ok = r.eintraege
    .map((e) => ({ test: String(e.test || ""), value: Number(e.wert), note: e.notiz ? String(e.notiz).slice(0, 80) : null, reps: Math.round(Number(e.wdh)) || null, dur: Math.round(Number(e.dauer_min)) || null }))
    .filter((e) => TEST_TYPES[e.test] && RANGE[e.test] && Number.isFinite(e.value) && e.value >= RANGE[e.test][0] && e.value <= RANGE[e.test][1])
    .filter((e) => TEST_TYPES[e.test].fmt !== "lift" || (e.reps >= 1 && e.reps <= 10))
    .map((e) => (TEST_TYPES[e.test].dur && !TEST_DURATIONS.includes(e.dur) ? null : e)).filter(Boolean);
  if (!ok.length) throw new Error(r.hinweis || "Auf der Datei wurde kein verwertbarer Testwert gefunden.");
  const day = r.datum || media.day;
  await repo.deleteManualBySource(userId, media.id);
  await repo.addManualMany(userId, ok.map((e) => ({ day, kind: "test", value: e.value, data: { test: e.test, note: [r.quelle, e.note].filter(Boolean).join(" · ") || null, ...(e.reps && TEST_TYPES[e.test].fmt === "lift" ? { reps: e.reps } : {}), ...(TEST_TYPES[e.test].dur ? { dur: e.dur } : {}) }, source_media: media.id, created_by: viewerId })));
  await repo.updateMedia(userId, media.id, { extracted: { date: day, quelle: r.quelle, tests: ok }, extract_error: null });
  return { day, tests: ok, quelle: r.quelle, hinweis: r.hinweis };
}
