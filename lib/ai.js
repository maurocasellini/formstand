// KI-Funktionen über die Claude-API: InBody-Blätter auslesen und Tagesempfehlungen schreiben.
// Der API-Schlüssel wird im Admin-Bereich hinterlegt (verschlüsselt), ANTHROPIC_API_KEY gilt als Vorgabe.
import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./repo";
import { read, update } from "./store";
import { decrypt } from "./crypto";

// Modellwahl nach Aufgabe: die Tageserklärung formuliert nur (kleines, günstiges Modell),
// beim Lesen von Blättern und Fotos zählt Genauigkeit (Sonnet, wenig Denkaufwand).
export const MODELS = {
  "claude-haiku-4-5": { name: "Claude Haiku 4.5", price: [1, 5] },
  "claude-sonnet-5-5": { name: "Claude Sonnet 5.5", price: [2, 10] },
  "claude-opus-5-5": { name: "Claude Opus 5.5", price: [4, 20] },
};
export const DEFAULTS = { adviceModel: "claude-haiku-4-5", visionModel: "claude-sonnet-5-5", monthlyCapUsd: 5 };
export const DEFAULT_MODEL = DEFAULTS.adviceModel;

export async function aiConfig() {
  const a = (await getSettings()).apps?.anthropic || {};
  // Bevorzugt: Schlüssel als (sensitive) Umgebungsvariable in Vercel – liegt dann nicht in der App-Datenbank
  let key = process.env.ANTHROPIC_API_KEY || "", source = key ? "env" : null;
  if (!key && a.apiKey) { try { key = decrypt(a.apiKey); source = "app"; } catch {} }
  const pick = (m, d) => (MODELS[m] ? m : d);
  return {
    key, source, adviceModel: pick(a.adviceModel, DEFAULTS.adviceModel), visionModel: pick(a.visionModel, DEFAULTS.visionModel),
    monthlyCapUsd: Number.isFinite(Number(a.monthlyCapUsd)) && a.monthlyCapUsd !== null ? Number(a.monthlyCapUsd) : DEFAULTS.monthlyCapUsd,
  };
}
export async function aiReady() { return Boolean((await aiConfig()).key); }
export const client = (key) => new Anthropic({ apiKey: key, ...(process.env.ANTHROPIC_BASE ? { baseURL: process.env.ANTHROPIC_BASE.replace(/\/v1\/?$/, "") } : {}) });

// ---------- Kosten ----------
const month = () => new Date().toISOString().slice(0, 7);
export const getUsage = () => read("ai_usage.json", {});
function costOf(model, u) {
  const [pin, pout] = MODELS[model]?.price || [2, 10];
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  return (inTok * pin + (u.output_tokens || 0) * pout) / 1e6;
}
async function track(kind, userId, model, usage) {
  const usd = costOf(model, usage || {});
  await update("ai_usage.json", {}, (all) => {
    const m = (all[month()] ||= { usd: 0, calls: 0, input: 0, output: 0, users: {}, kinds: {} });
    m.usd += usd; m.calls++; m.input += usage?.input_tokens || 0; m.output += usage?.output_tokens || 0;
    const uu = (m.users[userId || "system"] ||= { usd: 0, calls: 0 }); uu.usd += usd; uu.calls++;
    const kk = (m.kinds[kind] ||= { usd: 0, calls: 0 }); kk.usd += usd; kk.calls++;
    return Object.fromEntries(Object.entries(all).sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 12));
  });
  return usd;
}

// Ein Aufruf. task "advice" → günstiges Modell; "vision" → genaues Modell mit wenig Denkaufwand.
async function ask({ task, kind, userId, system, content, maxTokens = 2000 }) {
  const cfg = await aiConfig();
  if (!cfg.key) throw new Error("KI ist nicht freigeschaltet (Admin → Schnittstellen).");
  const used = (await getUsage())[month()]?.usd || 0;
  if (cfg.monthlyCapUsd > 0 && used >= cfg.monthlyCapUsd) throw new Error(`Monatslimit der KI erreicht ($${cfg.monthlyCapUsd}). Formstand läuft ohne KI-Texte weiter; das Limit lässt sich im Admin anheben.`);
  const model = task === "vision" ? cfg.visionModel : cfg.adviceModel;
  const c = client(cfg.key);
  const base = { model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] };
  let res;
  try {
    if (model === "claude-haiku-4-5") res = await c.messages.create(base); // ohne Denkphase: am günstigsten
    else res = await c.beta.messages.create({ ...base, output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Claude lehnt den API-Schlüssel ab (Admin → Schnittstellen).");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Claude ist gerade ausgelastet. Bitte in einer Minute nochmals.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude-API ${e.status ?? ""}: ${String(e.message).slice(0, 200)}`);
    throw e;
  }
  await track(kind, userId, res.model || model, res.usage);
  if (res.stop_reason === "refusal") throw new Error("Claude hat die Anfrage abgelehnt. Bitte ein anderes Bild versuchen.");
  if (res.stop_reason === "max_tokens") throw new Error("Antwort wurde abgeschnitten. Bitte nochmals versuchen.");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, model: res.model || model };
}

export function parseJson(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Antwort ohne JSON.");
  return JSON.parse(s.slice(a, b + 1));
}

// ---------- InBody ----------
export const INBODY_FIELDS = {
  weight_kg: ["Gewicht", "kg"], smm_kg: ["Skelettmuskelmasse", "kg"], fat_mass_kg: ["Fettmasse", "kg"], body_fat_pct: ["Körperfett", "%"],
  ffm_kg: ["Fettfreie Masse", "kg"], tbw_l: ["Körperwasser", "l"], protein_kg: ["Protein", "kg"], minerals_kg: ["Mineralien", "kg"],
  bmi: ["BMI", ""], visceral_level: ["Viszeralfett-Level", ""], bmr_kcal: ["Grundumsatz", "kcal"], ecw_ratio: ["ECW/TBW", ""],
  inbody_score: ["InBody-Score", "/100"], phase_angle: ["Phasenwinkel", "°"],
};

const INBODY_SYSTEM = `Du liest Ergebnisblätter von Körperanalysen (InBody, Tanita, Withings o. ä.) aus.
Antworte NUR mit einem JSON-Objekt, ohne Erklärung. Felder (Zahl oder null, Dezimalpunkt, keine Einheiten):
{"date":"YYYY-MM-DD oder null","device":"Text oder null",${Object.keys(INBODY_FIELDS).map((k) => `"${k}":null`).join(",")},
"segments":{"arm_r":{"lean_kg":null,"fat_kg":null},"arm_l":{"lean_kg":null,"fat_kg":null},"trunk":{"lean_kg":null,"fat_kg":null},"leg_r":{"lean_kg":null,"fat_kg":null},"leg_l":{"lean_kg":null,"fat_kg":null}},
"notes":"kurze Auffälligkeiten auf Deutsch oder null"}
Nur Werte übernehmen, die wirklich auf dem Blatt stehen. Nichts schätzen. Bei mehreren Messungen nur die aktuellste.`;

export async function readInBody(buffer, contentType, userId) {
  const b64 = Buffer.from(buffer).toString("base64");
  const media = contentType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: contentType, data: b64 } };
  const { text, model } = await ask({ task: "vision", kind: "inbody", userId, system: INBODY_SYSTEM, maxTokens: 3000, content: [media, { type: "text", text: "Bitte die Werte auslesen." }] });
  const out = parseJson(text);
  for (const k of Object.keys(INBODY_FIELDS)) { const v = out[k]; out[k] = v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v); }
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = null;
  return { ...out, model };
}

// ---------- Tagesempfehlung ----------
// Die Entscheidung trifft das Regelwerk (lib/decide.js). Claude erklärt sie nur – persönlich, mit Zahlen.
const COACH_SYSTEM = `Du bist ein erfahrener Ausdauer- und Kraftcoach mit sportwissenschaftlichem Hintergrund.
Formstand hat für HEUTE bereits eine Entscheidung getroffen (Feld "entscheidung"). Sie ist fix: Du änderst weder Art, Dauer noch Intensität und schlägst keine andere Einheit vor.
Deine Aufgabe: die Entscheidung erklären und ergänzen, damit der Sportler sie versteht und gerne umsetzt.
Regeln:
- Deutsch (Schweiz, kein ß), du-Form, konkret und knapp. Keine Floskeln, keine Wiederholung der Trainingsbeschreibung.
- Begründe mit seinen eigenen Zahlen (Abweichung zur Baseline, Perzentile, Zustände, Limiter, Check-in, Trigger-Erfahrung).
- Bei niedriger Datenqualität sag, was fehlt und wie sicher die Einschätzung ist.
- Ernährung: nutze die Zielwerte aus "entscheidung.nutrition" und mach sie alltagstauglich (konkrete Lebensmittel, Zeitpunkte).
- Keine Diagnosen; bei Krankheitsanzeichen zu Pause und Arzt raten.
Antworte NUR mit JSON:
{"headline":"max. 8 Wörter","summary":"1–2 Sätze: warum genau diese Einheit heute","why":["2–4 Begründungen mit Zahlen"],"recovery":"Schlaf/Erholung heute, 1 Satz","nutrition":"Ernährung heute konkret, 1–2 Sätze","watch":["0–2 Hinweise"]}`;

export async function writeAdvice(context, userId) {
  const { text, model } = await ask({ task: "advice", kind: "advice", userId, system: COACH_SYSTEM, maxTokens: 1500, content: [{ type: "text", text: `Daten (JSON):\n${JSON.stringify(context)}` }] });
  const a = parseJson(text);
  a.watch = Array.isArray(a.watch) ? a.watch.slice(0, 3).map(String) : [];
  a.why = Array.isArray(a.why) ? a.why.slice(0, 5).map(String) : [];
  return { headline: String(a.headline || ""), summary: String(a.summary || ""), why: a.why, recovery: a.recovery ? String(a.recovery) : null, nutrition: a.nutrition ? String(a.nutrition) : null, watch: a.watch, model };
}

// ---------- Körperfotos vergleichen ----------
const PHOTO_SYSTEM = `Du vergleichst zwei Körperfotos derselben Person (A = früher, B = später), um Trainingsfortschritt sichtbar zu machen.
Regeln:
- Sachlich und respektvoll. Kein Urteil über Aussehen oder Attraktivität, keine medizinischen Aussagen.
- Beschreibe nur, was wirklich sichtbar ist. Wenn Licht, Pose, Abstand oder Kleidung abweichen, sag das und sei vorsichtiger.
- Körperfett nur als grobe Spanne schätzen (z. B. [14, 18]) und nur, wenn es das Foto zulässt. Gemessene Referenzwerte (InBody, Gewicht) haben Vorrang vor deinem Eindruck.
- Deutsch (Schweiz, kein ß), du-Form, knapp.
Antworte NUR mit JSON:
{"vergleichbarkeit":"gut|mittel|schlecht","foto_hinweise":["0–3 konkrete Tipps für bessere Vergleichsfotos"],"zusammenfassung":"1–2 Sätze","regionen":[{"region":"Schultern|Arme|Brust|Bauch/Taille|Rücken|Beine|Gesamt","veraenderung":"definierter|weniger Fett|mehr Masse|gleich|weicher|unklar","beschreibung":"kurz"}],"kf_a":[0,0] oder null,"kf_b":[0,0] oder null}`;

export async function comparePhotos(a, b, refs, userId) {
  const img = (x) => ({ type: "image", source: { type: "base64", media_type: x.type, data: Buffer.from(x.buf).toString("base64") } });
  const { text, model } = await ask({
    task: "vision", kind: "photo", userId, system: PHOTO_SYSTEM, maxTokens: 2500,
    content: [{ type: "text", text: "Foto A (früher):" }, img(a), { type: "text", text: "Foto B (später):" }, img(b), { type: "text", text: `Kontext (JSON): ${JSON.stringify(refs)}` }],
  });
  const r = parseJson(text);
  const range = (x) => (Array.isArray(x) && x.length === 2 && x.every((v) => Number.isFinite(Number(v))) ? x.map(Number) : null);
  return {
    vergleichbarkeit: ["gut", "mittel", "schlecht"].includes(r.vergleichbarkeit) ? r.vergleichbarkeit : "mittel",
    foto_hinweise: Array.isArray(r.foto_hinweise) ? r.foto_hinweise.slice(0, 3).map(String) : [],
    zusammenfassung: String(r.zusammenfassung || ""),
    regionen: Array.isArray(r.regionen) ? r.regionen.slice(0, 8).map((x) => ({ region: String(x.region || ""), veraenderung: String(x.veraenderung || "unklar"), beschreibung: String(x.beschreibung || "") })) : [],
    kf_a: range(r.kf_a), kf_b: range(r.kf_b), model,
  };
}
