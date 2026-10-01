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
const COACH_SYSTEM = `Du bist ein erfahrener Ausdauer- und Kraftcoach mit sportwissenschaftlichem Hintergrund.
Du bekommst die Daten eines Sportlers (Recovery, Schlaf, Trainingslast, Trigger wie Alkohol, Tests, Körperwerte) und schreibst die Empfehlung für HEUTE.
Regeln:
- Deutsch (Schweiz, kein ß), du-Form, konkret und knapp. Keine Floskeln.
- Konkrete Einheit mit Dauer und Intensität. Wenn FTP oder Schwellenpuls bekannt: Watt- bzw. Pulsbereiche angeben.
- Begründe mit den Daten (z. B. HRV unter Baseline, Form/TSB, Schlafdefizit, Alkohol am Vorabend, Belastung der letzten Tage).
- Fehlende Daten offen benennen statt raten. Keine medizinischen Diagnosen; bei Krankheitsanzeichen zu Pause und Arzt raten.
Antworte NUR mit JSON:
{"headline":"max. 8 Wörter","state":"good|warn|crit","summary":"1–2 Sätze","training":"Hauptempfehlung","alternative":"Alternative, falls Zeit oder Lust fehlt","recovery":"Schlaf/Erholung","nutrition":"Ernährung/Trinken heute","watch":["0–3 Hinweise"],"why":["2–4 kurze Begründungen mit Zahlen"]}`;

export async function writeAdvice(context) {
  const { text, model } = await ask({ system: COACH_SYSTEM, maxTokens: 1500, content: [{ type: "text", text: `Daten (JSON):\n${JSON.stringify(context)}` }] });
  const a = parseJson(text);
  if (!["good", "warn", "crit"].includes(a.state)) a.state = "warn";
  a.watch = Array.isArray(a.watch) ? a.watch.slice(0, 4).map(String) : [];
  a.why = Array.isArray(a.why) ? a.why.slice(0, 5).map(String) : [];
  return { ...a, model };
}
