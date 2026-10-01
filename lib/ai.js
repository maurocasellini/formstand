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
  const searches = (u.server_tool_use?.web_search_requests || 0) * 0.01; // Websuche: 10 $ pro 1000
  return (inTok * pin + (u.output_tokens || 0) * pout) / 1e6 + searches;
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

async function guard() {
  const cfg = await aiConfig();
  if (!cfg.key) throw new Error("KI ist nicht freigeschaltet (Admin → Schnittstellen).");
  const used = (await getUsage())[month()]?.usd || 0;
  if (cfg.monthlyCapUsd > 0 && used >= cfg.monthlyCapUsd) throw new Error(`Monatslimit der KI erreicht ($${cfg.monthlyCapUsd}). Formstand läuft ohne KI-Texte weiter; das Limit lässt sich im Admin anheben.`);
  return cfg;
}
function apiError(e) {
  if (e instanceof Anthropic.AuthenticationError) return new Error("Claude lehnt den API-Schlüssel ab (Admin → Schnittstellen).");
  if (e instanceof Anthropic.RateLimitError) return new Error("Claude ist gerade ausgelastet. Bitte in einer Minute nochmals.");
  if (e instanceof Anthropic.APIError) return new Error(`Claude-API ${e.status ?? ""}: ${String(e.message).slice(0, 200)}`);
  return e;
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
    if (model === "claude-haiku-4-5") res = await c.messages.create({ ...base, temperature: 0.3 }); // ohne Denkphase: am günstigsten; ruhige Wortwahl
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

SPRACHE – sehr wichtig:
- Durchgehend Deutsch (Schweiz, kein ß), du-Form. KEINE englischen Wörter oder Mischsätze.
  Falsch → richtig: today → heute · Maintenance → Erhaltungsbedarf · Oatmeal → Haferflocken · Recovery → Erholung · Readiness → Bereitschaft · Load → Belastung · Meal → Mahlzeit · Snack → Zwischenmahlzeit · Workout → Einheit · Rest Day → Ruhetag.
- Erlaubte Fachbegriffe: HRV, FTP, VO2max, Zone 2, Sleep Score, Body Battery, CTL/ATL/TSB.
- Kurze, klare Sätze. Jeder Satz muss logisch stimmen und zur Entscheidung passen (z. B. „Ruhetag, damit du NICHT in eine Überlastung rutschst“).

INHALT:
- Begründe mit seinen eigenen Zahlen (Abweichung zur Baseline, Perzentile, Zustände, Limiter, Check-in, Trigger-Erfahrung).
- Nur Aussagen über Werte, die in den Daten stehen. Fehlen Schlaf, HRV oder Ruhepuls, sag nur, dass sie fehlen – schliesse NICHT aus der Bereitschaft auf den Schlaf. Steht bei "tagesform_basis" "nur Check-in", beruht die Bereitschaft allein auf dem Check-in.
- Form (TSB) positiv = ausgeruht, negativ = ermüdet.
- Bei niedriger Datenqualität sag, was fehlt und wie sicher die Einschätzung ist.
- Ernährung: nutze die Zielwerte aus "entscheidung.nutrition" und mach sie alltagstauglich (konkrete Lebensmittel aus der Schweizer Küche, Zeitpunkte).
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

// ---------- Wettkampf suchen ----------
// Claude sucht den Wettkampf im Web, ordnet ihn ein und fragt bei mehreren Kategorien nach.
// Günstiges Modell, höchstens 3 Suchen (je 1 Rappen).
const EVENT_SYSTEM = (types, weak, today) => `Du hilfst Ausdauer- und Hybridsportlern, einen Wettkampf in ihren Trainingsplan einzutragen. Heute ist ${today}.
Suche den genannten Wettkampf im Web (offizielle Seite bevorzugt) und finde heraus, was er genau ist.
Antworte danach NUR mit einem JSON-Objekt, ohne weiteren Text:
{"gefunden":true|false,
 "name":"offizieller Name inkl. Ort",
 "ort":"Ort, Land oder null",
 "datum":"YYYY-MM-DD der nächsten Austragung ab heute oder null",
 "datum_sicher":true|false,
 "typ":"einer von: ${types}",
 "beschreibung":"1–2 Sätze: Format, Disziplinen, Distanzen bzw. Stationen",
 "varianten":[{"name":"z. B. Single / Doubles / Pro / 100 km","beschreibung":"was diese Kategorie ausmacht, typische Dauer"}],
 "frage":"Rückfrage an den Sportler, falls mehrere Kategorien oder Distanzen möglich sind, sonst null",
 "schwerpunkte":["max. 4 kurze Punkte, worauf es im Training für dieses Rennen ankommt"],
 "schwaechen":["passende Schlüssel aus: ${weak}"],
 "url":"offizielle Webseite oder null"}
Regeln: Deutsch (Schweiz, kein ß). Nichts erfinden – Unsicheres als null bzw. datum_sicher=false. Gibt es mehrere Rennen mit diesem Namen, nimm das naheliegendste (Schweiz/Europa) und erwähne die Alternative in "frage". Hybrid-/Fitnessrennen wie ATHX, DEKA oder Spartan Hybrid sind Typ "hybrid", HYROX ist "hyrox".`;

export async function findEvent(query, { types, weaknesses, today }, userId) {
  const cfg = await guard();
  const c = client(cfg.key);
  const model = cfg.adviceModel;
  const messages = [{ role: "user", content: `Wettkampf: ${query}` }];
  const base = { model, max_tokens: 2500, system: EVENT_SYSTEM(types, weaknesses, today) };
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "CH", timezone: "Europe/Zurich" } }];
  let res, searched = true;
  const run = async (withTools) => {
    for (let i = 0; i < 4; i++) {
      const r = await c.messages.create({ ...base, messages, ...(withTools ? { tools } : {}) });
      await track("event", userId, r.model || model, r.usage);
      if (r.stop_reason !== "pause_turn") return r;
      messages.push({ role: "assistant", content: r.content });
    }
    throw new Error("Die Suche hat zu lange gedauert. Bitte nochmals versuchen.");
  };
  try { res = await run(true); }
  catch (e) {
    // Websuche in der Organisation nicht freigegeben → ohne Suche aus dem Modellwissen
    if (e instanceof Anthropic.BadRequestError && /web.?search|tool/i.test(String(e.message))) { searched = false; messages.splice(1); res = await run(false).catch((x) => { throw apiError(x); }); }
    else throw apiError(e);
  }
  if (res.stop_reason === "refusal") throw new Error("Claude hat die Anfrage abgelehnt.");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const out = parseJson(text);
  return { ...out, searched, model: res.model || model };
}

// ---------- Upload einordnen ----------
// Erkennt, was hochgeladen wurde (Körperfoto inkl. Pose, InBody-Blatt, Mahlzeit, Laborbefund, Sonstiges). Günstiges Modell, ~0,2 Rappen.
const CLASSIFY_SYSTEM = `Du ordnest eine hochgeladene Datei einer Trainings-App ein.
Antworte NUR mit JSON: {"art":"inbody|body_photo|test|meal|blood|other","pose":"front|side|back|null"}
- inbody: Ergebnisblatt einer Körperanalyse (InBody, Tanita, Withings, Waage-App-Screenshot mit Körperfett/Muskelmasse), auch abfotografiert.
- body_photo: Foto eines menschlichen Körpers zur Fortschrittskontrolle. pose: front = Vorderseite, side = seitlich, back = Rücken.
- meal: Foto von Essen oder Getränken.
- test: Ergebnis eines Leistungstests (FTP-/Ramp-Test, Laktat- oder Stufentest, VO2max, Schwellenpuls, Schwimmtest).
- blood: Laborbefund, Blutwerte.
- other: alles andere.
pose nur bei body_photo, sonst null.`;
export async function classifyUpload(buffer, contentType, userId) {
  const b64 = Buffer.from(buffer).toString("base64");
  const media = contentType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: contentType, data: b64 } };
  const { text } = await ask({ task: "advice", kind: "classify", userId, system: CLASSIFY_SYSTEM, maxTokens: 60, content: [media, { type: "text", text: "Was ist das?" }] });
  const o = parseJson(text);
  const art = ["inbody", "body_photo", "test", "meal", "blood", "other"].includes(o.art) ? o.art : "other";
  return { art, pose: art === "body_photo" && ["front", "side", "back"].includes(o.pose) ? o.pose : null };
}

// ---------- Körperanalyse aus Fotos ----------
// Fotos eines Tages (Front/Seite/Rücken) + Messwerte + Ziele → Einschätzung, Stärken, Defizite, Trainingsfokus.
const BODY_SYSTEM = (weakKeys) => `Du bist ein erfahrener Kraft- und Ausdauercoach. Du machst eine Gesamtanalyse des Körpers: aktueller Stand UND Entwicklung über die Zeit.
Grundlage: Körperfotos (jeweils mit Datum beschriftet – ältere Fotos dienen dem Vergleich), InBody-/Waagen-Verlauf, Gewichtsverlauf, Ziele, frühere Einschätzung.
Ziel: dem Sportler wie ein Coach im Gespräch sagen, wo er steht, was gut ist, wo Potenzial liegt, wie er sich entwickelt hat und woran ihr jetzt arbeitet.
Regeln:
- Sachlich, respektvoll, motivierend, ehrlich. Kein Urteil über Attraktivität, keine medizinischen Diagnosen.
- Nur beschreiben, was sichtbar oder gemessen ist. Licht, Pose, Kleidung und Abstand bei der Sicherheit berücksichtigen.
- Körperfett als Spanne schätzen (z. B. [13, 16]). Gemessene Werte (InBody, Waage) haben Vorrang; ordne sie ein statt ihnen zu widersprechen. Ohne aktuelle Fotos nur aus Messwerten schätzen oder null.
- Entwicklung: vergleiche ältere mit neueren Fotos und den Messverlauf (Muskelmasse, Fettmasse, Gewicht). Nenne konkrete Zahlen und Zeiträume. Gibt es nur einen Zeitpunkt, ist "entwicklung" null.
- Bezug zum Ziel (z. B. Radmarathon, HYROX, Abnehmen) und zur Sportart: Was hilft der Leistung, was fehlt?
- Deutsch (Schweiz, kein ß), du-Form, konkret, knapp. Keine englischen Wörter.
Antworte NUR mit JSON:
{"zusammenfassung":"2–3 Sätze wie ein Coach: wo du stehst, wichtigster Hebel",
 "kf":[0,0] oder null, "kf_sicherheit":"gut|mittel|grob",
 "staerken":["2–4 Punkte, was gut ist"],
 "defizite":["2–4 Punkte, wo Potenzial liegt"],
 "regionen":[{"region":"Schultern|Arme|Brust|Rücken|Rumpf/Bauch|Beine|Haltung","einschaetzung":"kurz","fokus":true|false}],
 "entwicklung":{"seit":"YYYY-MM-DD","bewertung":"sehr gut|gut|stabil|gemischt|rückläufig","text":"2–3 Sätze mit Zahlen","punkte":["1–4 konkrete Veränderungen"]} oder null,
 "training":[{"titel":"z. B. Oberkörper-Kraft 2× pro Woche","warum":"kurz","wie":"konkret: Übungen, Sätze, Häufigkeit"}],
 "ernaehrung":"1 Satz passend zum Ziel",
 "schwaechen":["0–3 Schlüssel aus: ${weakKeys}"],
 "foto_hinweise":["0–3 Tipps für bessere Vergleichsfotos"]}`;

const BEWERTUNG = ["sehr gut", "gut", "stabil", "gemischt", "rückläufig"];
export async function analyzeBody(photos, ctx, weakKeys, userId) {
  const img = (x) => ({ type: "image", source: { type: "base64", media_type: x.type, data: Buffer.from(x.buf).toString("base64") } });
  const content = [];
  for (const p of photos) { content.push({ type: "text", text: `Foto vom ${p.day} (${p.pose || "ohne Pose"})${p.old ? " – Vergleichsfoto" : " – aktuell"}:` }); content.push(img(p)); }
  if (!photos.length) content.push({ type: "text", text: "Keine Fotos – Analyse nur aus den Messwerten." });
  content.push({ type: "text", text: `Kontext (JSON): ${JSON.stringify(ctx)}` });
  const { text, model } = await ask({ task: "vision", kind: "body", userId, system: BODY_SYSTEM(weakKeys), maxTokens: 3500, content });
  const r = parseJson(text);
  const arr = (x, n) => (Array.isArray(x) ? x.slice(0, n).map(String) : []);
  const kf = Array.isArray(r.kf) && r.kf.length === 2 && r.kf.every((v) => Number.isFinite(Number(v))) ? r.kf.map(Number) : null;
  const e = r.entwicklung && typeof r.entwicklung === "object" && r.entwicklung.text ? r.entwicklung : null;
  return {
    zusammenfassung: String(r.zusammenfassung || ""), kf, kf_sicherheit: ["gut", "mittel", "grob"].includes(r.kf_sicherheit) ? r.kf_sicherheit : "grob",
    staerken: arr(r.staerken, 4), defizite: arr(r.defizite, 4),
    regionen: Array.isArray(r.regionen) ? r.regionen.slice(0, 8).map((x) => ({ region: String(x.region || ""), einschaetzung: String(x.einschaetzung || ""), fokus: Boolean(x.fokus) })) : [],
    entwicklung: e ? { seit: /^\d{4}-\d{2}-\d{2}$/.test(e.seit || "") ? e.seit : null, bewertung: BEWERTUNG.includes(e.bewertung) ? e.bewertung : "gemischt", text: String(e.text), punkte: arr(e.punkte, 4) } : null,
    training: Array.isArray(r.training) ? r.training.slice(0, 4).map((x) => ({ titel: String(x.titel || ""), warum: String(x.warum || ""), wie: String(x.wie || "") })) : [],
    ernaehrung: r.ernaehrung ? String(r.ernaehrung) : null,
    schwaechen: arr(r.schwaechen, 3), foto_hinweise: arr(r.foto_hinweise, 3), model,
  };
}

// ---------- Leistungstest auslesen ----------
// Screenshot oder PDF (Zwift, Garmin, Labor, Trainingsapp) → ein oder mehrere Testwerte
const TEST_SYSTEM = (types) => `Du liest Ergebnisse von Leistungstests aus Screenshots oder Berichten (Zwift, Garmin, TrainerRoad, intervals.icu, Laktat-Labor, Spiroergometrie, Schwimmtest).
Erlaubte Testarten (Schlüssel: Bedeutung, Einheit):
${types}
Antworte NUR mit JSON:
{"datum":"YYYY-MM-DD oder null","quelle":"z. B. Zwift Ramp Test, Labor XY","eintraege":[{"test":"Schlüssel","wert":Zahl,"notiz":"kurz, z. B. LT1 152 bpm / 245 W oder null"}],"hinweis":"kurz, falls etwas unklar ist, sonst null"}
Regeln:
- Nur Werte übernehmen, die wirklich dort stehen. Nichts schätzen oder umrechnen, ausser: Zwift Ramp Test ohne FTP-Angabe → nichts eintragen.
- FTP in Watt; Schwellenpuls/LT2 in bpm; VO2max in ml/kg/min; CSS in Sekunden pro 100 m.
- Ein Laborbericht kann mehrere Einträge liefern (z. B. Puls an LT2 als "labor" und VO2max als "vo2"). Watt an LT1/LT2 und Puls an LT1 in die Notiz.
- Deutsch (Schweiz, kein ß).`;

export async function readTestSheet(buffer, contentType, types, userId) {
  const b64 = Buffer.from(buffer).toString("base64");
  const media = contentType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: contentType, data: b64 } };
  const { text, model } = await ask({ task: "vision", kind: "test", userId, system: TEST_SYSTEM(types), maxTokens: 1500, content: [media, { type: "text", text: "Bitte die Testwerte auslesen." }] });
  const r = parseJson(text);
  return { datum: /^\d{4}-\d{2}-\d{2}$/.test(r.datum || "") ? r.datum : null, quelle: r.quelle ? String(r.quelle).slice(0, 80) : null, eintraege: Array.isArray(r.eintraege) ? r.eintraege : [], hinweis: r.hinweis ? String(r.hinweis).slice(0, 200) : null, model };
}
