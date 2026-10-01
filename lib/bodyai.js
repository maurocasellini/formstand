// Körperanalyse: neuester Fototag (bis 3 Posen) + Messwerte + Ziele → KI-Einschätzung, gespeichert je Fototag.
import * as repo from "./repo";
import { readFile } from "./files";
import { analyzeBody } from "./ai";
import { EVENT_TYPES, FOCUS, WEAKNESSES } from "./catalog";
import { todayIso } from "./metrics";

const OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function runBodyAnalysis(userId, day = null) {
  const media = (await repo.getMedia(userId)).filter((m) => m.kind === "body_photo" && OK.includes(m.content_type));
  if (!media.length) throw new Error("Noch keine Körperfotos (JPG, PNG oder WebP).");
  const d = day && media.some((m) => m.day === day) ? day : media.map((m) => m.day).sort().at(-1);
  const ofDay = media.filter((m) => m.day === d);
  const pick = ["front", "side", "back"].map((p) => ofDay.find((m) => m.pose === p)).filter(Boolean);
  const chosen = (pick.length ? pick : ofDay).slice(0, 3);
  const photos = [];
  for (const m of chosen) { const buf = await readFile(m.pathname); if (buf) photos.push({ buf, type: m.content_type, pose: m.pose }); }
  if (!photos.length) throw new Error("Fotos nicht lesbar.");

  const [manual, goals, user] = await Promise.all([repo.getManual(userId), repo.getGoals(userId), repo.getUser(userId)]);
  const near = (kind) => manual.filter((x) => x.kind === kind).map((x) => [Math.abs(new Date(x.day) - new Date(d)) / 864e5, x]).filter(([g]) => g <= 30).sort((a, b) => a[0] - b[0])[0]?.[1];
  const ib = near("inbody"), w = near("weight"), bf = near("bodyfat");
  const weights = manual.filter((x) => x.kind === "weight").sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-30);
  const ev = (goals.events || []).find((e) => e.date >= todayIso() && e.priority === "A") || (goals.events || []).find((e) => e.date >= todayIso());
  const ctx = {
    fotodatum: d, posen: photos.map((p) => p.pose || "unbekannt"),
    sportart: user?.sport || null, groesse_cm: user?.height_cm ?? null, alter: user?.birth_year ? new Date().getFullYear() - user.birth_year : null,
    ziel: FOCUS[goals.focus]?.[0] || null, zielgewicht_kg: goals.targetWeight || null, ziel_koerperfett_pct: goals.targetBodyfat || null,
    naechster_wettkampf: ev ? { art: EVENT_TYPES[ev.type]?.[0], name: ev.name, datum: ev.date } : null,
    bisherige_schwaechen: [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean).map((k) => WEAKNESSES[k]?.[0]),
    inbody: ib?.data ? { datum: ib.day, gewicht_kg: ib.data.weight_kg ?? null, skelettmuskel_kg: ib.data.smm_kg ?? null, fettmasse_kg: ib.data.fat_mass_kg ?? null, koerperfett_pct: ib.data.body_fat_pct ?? null, viszeral: ib.data.visceral_level ?? null, segmente: ib.data.segments || null } : null,
    gewicht_kg: w ? Number(w.value) : user?.weight_kg ?? null, koerperfett_gemessen_pct: bf ? Number(bf.value) : null,
    gewichtsverlauf: weights.length >= 2 ? { von: Number(weights[0].value), bis: Number(weights.at(-1).value), tage: Math.round((new Date(weights.at(-1).day) - new Date(weights[0].day)) / 864e5) } : null,
  };
  const r = await analyzeBody(photos, ctx, Object.keys(WEAKNESSES).join(", "), userId);
  r.schwaechen = r.schwaechen.filter((k) => WEAKNESSES[k]);
  r.photos = chosen.map((m) => m.id);
  await repo.saveBodyAnalysis(userId, d, r);
  return { day: d, ...r };
}
