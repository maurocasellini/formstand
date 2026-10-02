// Ernährungstagebuch: gegessene Kalorien und Makros pro Tag.
// Quellen: MyFitnessPal/Cronometer-Export (CSV) und – falls geliefert – Garmin/intervals.icu (kcalConsumed, Makros).
// MyFitnessPal hat keine offene API mehr; der Export (Premium) oder die Verbindung MyFitnessPal → Garmin Connect sind die Wege.

// CSV-Zeile mit Anführungszeichen korrekt aufteilen (Komma oder Semikolon)
function splitCsv(line, sep) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
const num = (v) => { const n = Number(String(v || "").replace(/'/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
function dayOf(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; // US-Format von MyFitnessPal
  return null;
}

// Erkennt MyFitnessPal («Nutrition Summary»: Date, Meal, Calories, Fat (g), …, Carbohydrates (g), Protein (g))
// und Cronometer («Daily Summary»: Date, Energy (kcal), Carbs (g), Protein (g), Fat (g)); summiert Mahlzeiten je Tag.
export function parseNutritionCsv(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("Die Datei ist leer.");
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
  const head = splitCsv(lines[0], sep).map((h) => h.toLowerCase());
  const find = (...res) => head.findIndex((h) => res.some((re) => re.test(h)));
  const iDate = find(/^date$/, /^datum$/, /^day$/, /^tag$/);
  const iKcal = find(/^calories/, /^energy/, /^kalorien/, /^energie/, /kcal/);
  const iCarb = find(/^carbohydrates/, /^carbs/, /^kohlenhydrate/);
  const iProt = find(/^protein/, /^eiweiss/, /^eiweiß/);
  const iFat = find(/^fat( \(g\))?$/, /^fat \(g\)/, /^fett( \(g\))?$/, /^total fat/);
  if (iDate < 0 || iKcal < 0) throw new Error("Spalten «Date» und «Calories» nicht gefunden – bitte den Ernährungs-Export (Nutrition Summary) von MyFitnessPal oder die Daily Summary von Cronometer hochladen.");
  const by = new Map();
  for (const l of lines.slice(1)) {
    const c = splitCsv(l, sep), day = dayOf(c[iDate]);
    if (!day) continue;
    const o = by.get(day) || { kcal: 0, carbs_g: 0, protein_g: 0, fat_g: 0, meals: 0 };
    o.kcal += num(c[iKcal]) || 0;
    if (iCarb >= 0) o.carbs_g += num(c[iCarb]) || 0;
    if (iProt >= 0) o.protein_g += num(c[iProt]) || 0;
    if (iFat >= 0) o.fat_g += num(c[iFat]) || 0;
    o.meals++;
    by.set(day, o);
  }
  const days = [...by.entries()].map(([day, o]) => ({ day, kcal: Math.round(o.kcal), carbs_g: Math.round(o.carbs_g), protein_g: Math.round(o.protein_g), fat_g: Math.round(o.fat_g), meals: o.meals }))
    .filter((d) => d.kcal > 200 && d.kcal < 12000).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (!days.length) throw new Error("Keine Tage mit Kalorien gefunden.");
  return days;
}

// Gegessen an einem Tag: eigener Import hat Vorrang vor Garmin/intervals.icu
export function foodOf(d) {
  if (d?.food) return d.food;
  if (d?.kcalIn != null) return { kcal: Math.round(d.kcalIn), carbs_g: d.carbsIn ?? null, protein_g: d.proteinIn ?? null, fat_g: d.fatIn ?? null, src: "Garmin" };
  return null;
}

// Zusammenfassung über n Tage (nur Tage mit Daten)
export function foodSummary(all, n = 7) {
  const ds = all.slice(-n - 1, -1).map((d) => ({ day: d.day, f: foodOf(d) })).filter((x) => x.f);
  if (!ds.length) return null;
  const avg = (k) => { const v = ds.map((x) => x.f[k]).filter((x) => x != null && x > 0); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  return { days: ds.length, of: n, kcal: avg("kcal"), carbs_g: avg("carbs_g"), protein_g: avg("protein_g"), fat_g: avg("fat_g"), last: ds.at(-1) };
}
