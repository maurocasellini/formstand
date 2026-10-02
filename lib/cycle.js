// Zyklus-Tracking (nur bei Geschlecht «Frau» und eingeschaltet): Periodenstarts → Zyklustag, Phase, Prognose,
// Hinweise für Training/Ernährung/Erholung und – ab 2 Zyklen – wie HRV und Ruhepuls bei DIR je Phase reagieren.
// Quellen: eigene Einträge (Tagebuch/Übersicht) und, falls vorhanden, die Zyklusphase aus intervals.icu.
import { addDays } from "./metrics";

const mean = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const diff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

export const CYCLE_MODES = { natural: "Natürlicher Zyklus", hormonal: "Hormonelle Verhütung (Pille, Spirale mit Hormon …)", none: "Kein Zyklus (Schwangerschaft, Wechseljahre …)" };
export const SYMPTOMS = [["kraempfe", "Krämpfe"], ["muede", "Müdigkeit"], ["kopf", "Kopfschmerzen"], ["bauch", "Blähbauch"], ["stimmung", "Stimmungstief"], ["schlaf", "Schlechter Schlaf"], ["hunger", "Heisshunger"], ["stark", "Starke Blutung"]];
export const PHASES = {
  mens: ["Menstruation", "Energie oft tiefer, besonders an Tag 1–2. Training nach Gefühl – lockere Bewegung lindert Krämpfe häufig."],
  foll: ["Follikelphase", "Östrogen steigt: oft gute Phase für harte Einheiten, Intervalle und Krafttraining."],
  ov: ["Eisprung", "Viele fühlen sich stark. Bänder sind etwas lockerer – bei Sprüngen und Richtungswechseln sauber aufwärmen."],
  lut: ["Lutealphase", "Progesteron steigt: Körpertemperatur und Ruhepuls leicht höher, HRV etwas tiefer – das ist normal, kein Erholungsproblem."],
  late: ["Späte Lutealphase", "Vor der Periode: oft müder, mehr Hunger, schlechterer Schlaf. Intensität nach Gefühl, genug Kohlenhydrate und Schlaf."],
};

// Periodenstarts aus Einträgen (kind "period") und intervals.icu-Phasen (Übergang zu PERIOD)
export function periodStarts(manual = [], all = []) {
  const set = new Set(manual.filter((e) => e.kind === "period").map((e) => e.day));
  let prev = null;
  for (const d of all) { const p = d.cyclePhase; if (p === "PERIOD" && prev !== "PERIOD") set.add(d.day); prev = p; }
  // Einträge innerhalb von 10 Tagen nach einem Start sind derselbe Zyklus
  const out = [];
  for (const d of [...set].sort()) if (!out.length || diff(out.at(-1), d) >= 10) out.push(d);
  return out;
}

// Phase für einen Zyklustag (1-basiert) bei Zykluslänge len und Periodenlänge pl
export function phaseOf(day, len = 28, pl = 5) {
  const ov = Math.max(pl + 3, len - 14);
  if (day <= pl) return "mens";
  if (day < ov - 1) return "foll";
  if (day <= ov + 1) return "ov";
  if (day > len - 5) return "late";
  return "lut";
}

export function cycleInfo({ user = {}, manual = [], all = [], today }) {
  if (user.sex !== "w" || !user.cycle_on) return null;
  const mode = user.cycle_mode || "natural";
  const starts = periodStarts(manual, all);
  const lens = starts.slice(1).map((d, i) => diff(starts[i], d)).filter((n) => n >= 18 && n <= 45).slice(-6);
  const len = lens.length ? Math.round(mean(lens)) : Number(user.cycle_len) || 28;
  const pl = Number(user.period_len) || 5;
  const last = starts.filter((d) => d <= today).at(-1) || null;
  const sym = manual.filter((e) => e.kind === "cycle_sym" && e.day === today).flatMap((e) => e.data?.s || []);
  const base = { mode, starts, len, pl, lens, regular: lens.length >= 3 ? Math.max(...lens) - Math.min(...lens) <= 7 : null, symptomsToday: sym };
  if (!last) return { ...base, day: null, phase: null };
  const day = diff(last, today) + 1;
  const nextStart = addDays(last, len), daysToNext = diff(today, nextStart);
  if (mode !== "natural") return { ...base, last, day, phase: day <= pl ? "mens" : null, nextStart: mode === "hormonal" ? nextStart : null, daysToNext: mode === "hormonal" ? daysToNext : null };
  const late = day > len + 3; // überfällig
  const phase = late ? "late" : phaseOf(day, len, pl);

  // Persönlich: HRV/Ruhepuls je Phase gegen den Zyklusschnitt (ab 2 vollständigen Zyklen)
  let personal = null;
  if (starts.length >= 3) {
    const by = { mens: [], foll: [], ov: [], lut: [], late: [] }, all2 = [];
    for (let k = 0; k < starts.length - 1; k++) {
      const L = diff(starts[k], starts[k + 1]); if (L < 18 || L > 45) continue;
      for (const d of all.filter((x) => x.day >= starts[k] && x.day < starts[k + 1])) {
        const ph = phaseOf(diff(starts[k], d.day) + 1, L, pl);
        by[ph].push(d); all2.push(d);
      }
    }
    const mh = mean(all2.map((d) => d.hrv)), mr = mean(all2.map((d) => d.rhr)), ms = mean(all2.map((d) => d.score));
    if (mh || mr) personal = Object.fromEntries(Object.entries(by).map(([ph, ds]) => [ph, {
      hrvPct: mh && ds.length >= 3 ? Math.round(((mean(ds.map((d) => d.hrv)) / mh) - 1) * 100) : null,
      rhr: mr && ds.length >= 3 ? Math.round((mean(ds.map((d) => d.rhr)) - mr) * 10) / 10 : null,
      score: ms && ds.length >= 3 ? Math.round(mean(ds.map((d) => d.score)) - ms) : null, n: ds.length,
    }]));
  }
  const tips = {
    mens: { training: "Nach Gefühl: lockere Ausdauer oder Technik; harte Einheiten nur, wenn du dich gut fühlst.", food: "Eisenreich essen (Fleisch, Hülsenfrüchte mit Vitamin C), genug trinken.", recovery: "Wärme und lockere Bewegung helfen oft gegen Krämpfe." },
    foll: { training: "Gutes Fenster für Intervalle, Schwelle und schwere Kraftsätze.", food: "Normal nach Plan; Kohlenhydrate rund um harte Einheiten.", recovery: "Erholst dich meist schneller." },
    ov: { training: "Leistungsfähig – Intensität ok; bei Sprüngen/Richtungswechseln gründlich aufwärmen.", food: "Normal nach Plan.", recovery: "Normal." },
    lut: { training: "Ausdauer und Kraft gut möglich; bei Hitze früher trinken, die Körpertemperatur ist leicht höher.", food: "Etwa +100–200 kcal pro Tag, vor allem Kohlenhydrate und Protein.", recovery: "Ruhepuls +1–3 bpm und tiefere HRV sind in dieser Phase normal." },
    late: { training: "Intensität nach Gefühl; wenn die Energie fehlt, lieber Grundlage als Intervalle.", food: "Heisshunger mit komplexen Kohlenhydraten und Protein abfangen; Magnesium kann helfen.", recovery: "Schlaf priorisieren – er ist oft unruhiger." },
  }[phase];
  return { ...base, last, day, phase, late, nextStart, daysToNext, ovDay: Math.max(pl + 3, len - 14), personal, tips };
}

// Für die KI: knapp und nur das Nötige
export const cycleBrief = (c) => (c && c.day ? { zyklustag: c.day, phase: c.phase ? PHASES[c.phase][0] : null, modus: CYCLE_MODES[c.mode], zykluslaenge: c.len, naechste_periode_in_tagen: c.daysToNext ?? null, symptome_heute: c.symptomsToday, persoenlich_je_phase: c.personal ? Object.fromEntries(Object.entries(c.personal).map(([k, v]) => [PHASES[k][0], v])) : null } : null);
