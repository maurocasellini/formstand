// KI-Funktionen über die Claude-API: InBody-Blätter auslesen und Tagesempfehlungen schreiben.
// Der API-Schlüssel wird im Admin-Bereich hinterlegt (verschlüsselt), ANTHROPIC_API_KEY gilt als Vorgabe.
import { getSettings } from "./repo";
import { decrypt } from "./crypto";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE || "https://api.anthropic.com/v1";

export async function aiConfig() {
  const a = (await getSettings()).apps?.anthropic || {};
  let key = process.env.ANTHROPIC_API_KEY || "";
  if (a.apiKey) { try { key = decrypt(a.apiKey); } catch {} }
  return { key, model: a.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL };
}
export async function aiReady() { return Boolean((await aiConfig()).key); }

async function ask({ system, content, maxTokens = 1500 }) {
  const { key, model } = await aiConfig();
  if (!key) throw new Error("KI ist nicht freigeschaltet (Admin → Schnittstellen).");
  const res = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude-API ${res.status}: ${body?.error?.message || "Fehler"}`.slice(0, 300));
  const text = (body.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return { text, model };
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

export async function readInBody(buffer, contentType) {
  const b64 = Buffer.from(buffer).toString("base64");
  const media = contentType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: contentType, data: b64 } };
  const { text, model } = await ask({ system: INBODY_SYSTEM, maxTokens: 1200, content: [media, { type: "text", text: "Bitte die Werte auslesen." }] });
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

export async function writeAdvice(context) {
  const { text, model } = await ask({ system: COACH_SYSTEM, maxTokens: 1200, content: [{ type: "text", text: `Daten (JSON):\n${JSON.stringify(context)}` }] });
  const a = parseJson(text);
  a.watch = Array.isArray(a.watch) ? a.watch.slice(0, 3).map(String) : [];
  a.why = Array.isArray(a.why) ? a.why.slice(0, 5).map(String) : [];
  return { headline: String(a.headline || ""), summary: String(a.summary || ""), why: a.why, recovery: a.recovery ? String(a.recovery) : null, nutrition: a.nutrition ? String(a.nutrition) : null, watch: a.watch, model };
}
