// Körper-Gesamtanalyse: aktuelle Fotos (bis 3 Posen) + ältere Vergleichsfotos + InBody-/Gewichtsverlauf + Ziele
// → KI-Einschätzung mit Entwicklung über die Zeit. Jede Analyse wird mit Datum gespeichert (Verlauf).
import * as repo from "./repo";
import { readFile } from "./files";
import { analyzeBody } from "./ai";
import { EVENT_TYPES, FOCUS, WEAKNESSES } from "./catalog";
import { todayIso } from "./metrics";
import { targetsOf, targetsBrief } from "./targets";
import { fitnessProfile, fitnessBrief } from "./fitness";

const OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const POSES = ["front", "side", "back"];
const r1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);

// Aus einem Fototag die passende Pose wählen (bevorzugt wie beim aktuellen Tag)
const pickPose = (list, pose) => list.find((m) => m.pose === pose) || list.find((m) => m.pose === "front") || list[0];

export async function runBodyAnalysis(userId) {
  const [mediaAll, manual, goals, user, prevAll] = await Promise.all([repo.getMedia(userId), repo.getManual(userId), repo.getGoals(userId), repo.getUser(userId), repo.getBodyAnalyses(userId)]);
  const media = mediaAll.filter((m) => m.kind === "body_photo" && OK.includes(m.content_type));
  const ib = manual.filter((x) => x.kind === "inbody" && x.data).sort((a, b) => (a.day < b.day ? -1 : 1));
  const weights = manual.filter((x) => x.kind === "weight").sort((a, b) => (a.day < b.day ? -1 : 1));
  if (!media.length && !ib.length) throw new Error("Noch keine Körperfotos oder InBody-Messungen – lade zuerst etwas hoch.");

  // Fotos: neuester Tag (bis 3 Posen) + ältester Tag + ein Tag dazwischen (bei mehr als 8 Wochen Abstand)
  const days = [...new Set(media.map((m) => m.day))].sort();
  const chosen = [];
  if (days.length) {
    const last = days.at(-1), ofLast = media.filter((m) => m.day === last);
    const cur = POSES.map((p) => ofLast.find((m) => m.pose === p)).filter(Boolean);
    for (const m of [...cur, ...ofLast.filter((x) => !cur.includes(x))].slice(0, 3)) chosen.push({ m, old: false });
    const ref = chosen[0]?.m.pose || "front";
    const olds = [];
    if (days.length > 1) olds.push(days[0]);
    if (days.length > 2 && (new Date(last) - new Date(days[0])) / 864e5 > 56) olds.push(days[Math.floor((days.length - 1) / 2)]);
    for (const d of [...new Set(olds)]) if (d !== last) chosen.push({ m: pickPose(media.filter((m) => m.day === d), ref), old: true });
  }
  const photos = [];
  for (const { m, old } of chosen) { const buf = await readFile(m.pathname); if (buf) photos.push({ buf, type: m.content_type, pose: m.pose, day: m.day, old, id: m.id }); }
  if (days.length && !photos.length && !ib.length) throw new Error("Fotos nicht lesbar.");

  const ev = (goals.events || []).find((e) => e.date >= todayIso() && e.priority === "A") || (goals.events || []).find((e) => e.date >= todayIso());
  const bf = manual.filter((x) => x.kind === "bodyfat").sort((a, b) => (a.day < b.day ? -1 : 1));
  // Gewicht: höchstens ~12 Punkte über den ganzen Zeitraum
  const step = Math.max(1, Math.ceil(weights.length / 12));
  const wSeries = weights.filter((_, i) => i % step === 0 || i === weights.length - 1).map((w) => [w.day, r1(w.value)]);
  const prev = Object.values(prevAll).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const photoDays = new Set(photos.map((p) => p.day)).size;
  const ctx = {
    heute: todayIso(),
    fotos: photos.map((p) => ({ datum: p.day, pose: p.pose || "unbekannt", rolle: p.old ? "Vergleich" : "aktuell" })),
    sportart: user?.sport || null, groesse_cm: user?.height_cm ?? null, alter: user?.birth_year ? new Date().getFullYear() - user.birth_year : null,
    ziel: FOCUS[goals.focus]?.[0] || null, zielgewicht_kg: goals.targetWeight || null, ziel_koerperfett_pct: goals.targetBodyfat || null,
    naechster_wettkampf: ev ? { art: EVENT_TYPES[ev.type]?.[0], name: ev.name, datum: ev.date } : null,
    bisherige_schwaechen: [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean).map((k) => WEAKNESSES[k]?.[0]),
    inbody_verlauf: ib.slice(-8).map((x) => ({ datum: x.day, gewicht_kg: x.data.weight_kg ?? null, skelettmuskel_kg: x.data.smm_kg ?? null, fettmasse_kg: x.data.fat_mass_kg ?? null, koerperfett_pct: x.data.body_fat_pct ?? null, viszeral: x.data.visceral_level ?? null })),
    inbody_segmente_aktuell: ib.at(-1)?.data?.segments || null,
    gewichtsverlauf: wSeries.length ? wSeries : null,
    koerperfett_gemessen: bf.length ? bf.slice(-6).map((x) => [x.day, r1(x.value)]) : null,
    messbare_ziele: targetsBrief(targetsOf(goals, manual, [], todayIso())),
    fitness_profil: fitnessBrief(fitnessProfile(manual, { sex: user?.sex, kg: user?.weight_kg, goals, profile: user || {}, today: todayIso() })),
    fruehere_einschaetzung: prev ? { datum: prev.day, zusammenfassung: prev.zusammenfassung, kf: prev.kf } : null,
  };
  const r = await analyzeBody(photos, ctx, Object.keys(WEAKNESSES).join(", "), userId);
  r.schwaechen = r.schwaechen.filter((k) => WEAKNESSES[k]);
  r.photos = photos.filter((p) => !p.old).map((p) => p.id);
  r.ref_photos = photos.filter((p) => p.old).map((p) => p.id);
  r.photo_day = days.at(-1) || null;
  r.basis = [photos.length && `${photos.length} Foto${photos.length > 1 ? "s" : ""} von ${photoDays} Tag${photoDays > 1 ? "en" : ""}`, ib.length && `${ib.length} InBody-Messung${ib.length > 1 ? "en" : ""}`, weights.length && `${weights.length} Gewichtswerte`].filter(Boolean).join(" · ");
  const day = todayIso();
  await repo.saveBodyAnalysis(userId, day, r);
  return { day, ...r };
}
