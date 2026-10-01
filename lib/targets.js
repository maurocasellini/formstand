// Messbare Ziele: «Was will ich bis wann erreichen?» – Startwert, Zielwert, Zieldatum.
// Fortschritt gegen die Zeit: Bin ich auf Kurs? Was ist pro Woche noch nötig? Und was heisst das für Plan und Ernährung?
import { TEST_TYPES, e1rm, mss } from "./catalog";

const r1 = (v) => Math.round(v * 10) / 10;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// Messgrössen: Körper + jeder bewertbare Test. dir: Richtung, in der «besser» liegt (für Plausibilität)
export const TARGET_METRICS = {
  weight: { name: "Körpergewicht", unit: "kg", group: "Körper", step: 0.1 },
  bodyfat: { name: "Körperfett", unit: "%", group: "Körper", step: 0.1 },
  smm: { name: "Skelettmuskelmasse (InBody)", unit: "kg", group: "Körper", step: 0.1 },
  ftp: { name: "FTP", unit: "W", group: "Ausdauer", step: 1, area: "schwelle" },
  vo2max: { name: "VO2max (Uhr oder Test)", unit: "ml/kg/min", group: "Ausdauer", step: 0.1, area: "vo2" },
  ...Object.fromEntries(Object.entries(TEST_TYPES).filter(([k, t]) => t.norms || ["css", "labor", "garmin_lt"].includes(k)).map(([k, t]) => [`t:${k}`, {
    name: t.fmt === "lift" ? `${t.name} (1RM geschätzt)` : t.dur ? `${t.name} (pro 5 min)` : t.name,
    unit: t.fmt === "lift" ? "kg" : t.fmt === "time" || t.fmt === "pace" ? (t.fmt === "pace" ? "min/km" : "Zeit") : t.dur ? "Wdh. in 5 min" : t.unit,
    group: t.group === "kraft" ? "Kraft" : t.group === "lauf" ? "Lauf & Rudern" : t.group === "fitness" ? "Fitness" : "Ausdauer",
    time: t.fmt === "time" || t.fmt === "pace", test: k, area: t.area || (k === "css" ? "schwimmen" : k === "vo2" ? "vo2" : "schwelle"), step: 1,
  }])),
  free: { name: "Freies Ziel (ohne Messwert)", unit: "", group: "Sonstiges" },
};

// Aktuelle Messwerte je Grösse als Verlauf [{day, v}] aufsteigend
export function seriesOf(metric, manual = [], all = []) {
  const out = [];
  const add = (day, v) => { if (day && v != null && Number.isFinite(Number(v))) out.push({ day, v: Number(v) }); };
  if (metric === "weight") { for (const d of all) if (d.weight != null) add(d.day, d.weight); for (const e of manual) { if (e.kind === "weight") add(e.day, e.value); if (e.kind === "inbody") add(e.day, e.data?.weight_kg); } }
  else if (metric === "bodyfat") for (const e of manual) { if (e.kind === "bodyfat") add(e.day, e.value); if (e.kind === "inbody") add(e.day, e.data?.body_fat_pct); }
  else if (metric === "smm") for (const e of manual) { if (e.kind === "inbody") add(e.day, e.data?.smm_kg); }
  else if (metric === "vo2max") { for (const d of all) add(d.day, d.vo2max); for (const e of manual) if (e.kind === "test" && e.data?.test === "vo2") add(e.day, e.value); }
  else if (metric === "ftp") for (const e of manual) { if (e.kind === "test" && TEST_TYPES[e.data?.test]?.ftp) add(e.day, e.value); }
  else if (metric.startsWith("t:")) {
    const k = metric.slice(2), t = TEST_TYPES[k];
    for (const e of manual) if (e.kind === "test" && e.data?.test === k) add(e.day, t.fmt === "lift" ? e1rm(Number(e.value), e.data?.reps || 1) : t.dur ? (Number(e.value) / (Number(e.data?.dur) || 1)) * 5 : e.value);
  }
  // pro Tag der letzte Wert
  const by = new Map(); for (const x of out.sort((a, b) => (a.day < b.day ? -1 : 1))) by.set(x.day, x.v);
  return [...by.entries()].map(([day, v]) => ({ day, v }));
}
// Gewicht schwankt täglich: Mittel der letzten 7 Messtage
const smooth = (metric, s) => (metric === "weight" && s.length ? r1(s.slice(-7).reduce((a, x) => a + x.v, 0) / Math.min(7, s.length)) : s.at(-1)?.v ?? null);

export const fmtVal = (metric, v) => {
  if (v == null) return "–";
  const m = TARGET_METRICS[metric]; if (!m) return String(v);
  if (m.time) return metric === "t:norwegian" ? `${mss(v)}/km` : mss(v);
  if (m.unit === "Wdh. in 5 min") return `${Math.round(v)} Wdh./5 min`;
  return `${(m.step < 1 ? r1(v) : Math.round(v)).toLocaleString("de-CH")} ${m.unit}`.trim();
};

// Status eines Ziels
export function targetStatus(t, manual, all, today) {
  const m = TARGET_METRICS[t.metric];
  if (!m || t.metric === "free") return { ...t, name: t.label || m?.name || "Ziel", free: true, timePct: t.by ? Math.max(0, Math.min(100, Math.round((days(t.startDay, today) / Math.max(1, days(t.startDay, t.by))) * 100))) : null, daysLeft: t.by ? days(today, t.by) : null, status: t.by && today > t.by ? "abgelaufen" : "offen", tone: "" };
  const s = seriesOf(t.metric, manual, all);
  const since = s.filter((x) => x.day > t.startDay);
  const cur = since.length ? smooth(t.metric, s) : null;
  const start = Number(t.start), target = Number(t.target);
  const span = target - start;
  const progress = cur == null || !span ? 0 : (cur - start) / span;
  const total = Math.max(1, days(t.startDay, t.by)), elapsed = Math.max(0, days(t.startDay, today));
  const timeShare = Math.min(1, elapsed / total), left = days(today, t.by);
  let status, tone;
  if (cur != null && progress >= 1) { status = "erreicht"; tone = "good"; }
  else if (left < 0) { status = "Zieldatum vorbei"; tone = "crit"; }
  else if (cur == null) { status = "noch keine neue Messung"; tone = ""; }
  else if (progress >= timeShare - 0.1) { status = "auf Kurs"; tone = "good"; }
  else if (progress >= timeShare - 0.25) { status = "knapp hinter Plan"; tone = "warn"; }
  else { status = "hinter Plan"; tone = "crit"; }
  // Nötiges Tempo für den Rest
  const remaining = cur == null ? span : target - cur;
  const weeks = Math.max(1, left / 7);
  const perWeek = remaining / weeks;
  const perWeekTxt = progress >= 1 || left < 0 ? null : m.time ? `${Math.abs(Math.round(perWeek))} s pro Woche ${perWeek < 0 ? "schneller" : "langsamer"}` : `${perWeek > 0 ? "+" : "−"}${Math.abs(m.step < 1 ? r1(perWeek) : Math.round(perWeek * 10) / 10).toLocaleString("de-CH")} ${m.unit === "Wdh. in 5 min" ? "Wdh." : m.unit} pro Woche`;
  const lastDay = s.at(-1)?.day || null;
  return {
    ...t, name: t.label || m.name, unit: m.unit, cur, curTxt: fmtVal(t.metric, cur), startTxt: fmtVal(t.metric, start), targetTxt: fmtVal(t.metric, target),
    progressPct: Math.max(0, Math.min(100, Math.round(progress * 100))), timePct: Math.round(timeShare * 100), daysLeft: left, status, tone, perWeekTxt,
    lastDay, stale: lastDay ? days(lastDay, today) > (t.metric.startsWith("t:") ? 42 : 14) : true,
  };
}

// Ehrgeiz prüfen: Gewicht max. ~1 %/Woche, Körperfett ~0,5 Punkte/Woche
export function ambition(metric, start, target, startDay, by) {
  const w = Math.max(1, days(startDay, by) / 7);
  if (metric === "weight" && target < start) { const pct = ((start - target) / start / w) * 100; return { pct: r1(pct), warn: pct > 1 ? `Das sind ${r1(pct)} % pro Woche – mehr als 1 % kostet meist Muskeln und Leistung. Besser das Datum später setzen.` : null }; }
  if (metric === "weight" && target > start) { const kgW = (target - start) / w; return { warn: kgW > 0.35 ? `${r1(kgW)} kg pro Woche Zunahme ist viel – realistisch für Muskelaufbau sind 0,1–0,3 kg.` : null }; }
  if (metric === "bodyfat" && target < start) { const p = (start - target) / w; return { warn: p > 0.6 ? `${r1(p)} Prozentpunkte pro Woche ist sehr ehrgeizig – 0,2–0,5 sind realistisch.` : null }; }
  return { warn: null };
}

// Was die Ziele für Plan und Ernährung bedeuten: Fokus, Abnehm-Tempo, Zielgewicht, Schwächen
export function goalEffects(targets = [], current = {}) {
  const out = { areas: [] };
  for (const t of targets) {
    const m = TARGET_METRICS[t.metric]; if (!m) continue;
    if (t.metric === "weight" && t.target < t.start) {
      const w = Math.max(1, days(new Date().toISOString().slice(0, 10), t.by) / 7), now = current.weight || t.start;
      const pct = ((now - t.target) / now / w) * 100;
      out.focus = "cut"; out.targetWeight = t.target; out.rate = [0.25, 0.5, 0.75, 1].find((x) => x >= pct - 0.05) || 1;
    }
    if (t.metric === "weight" && t.target > t.start) { out.focus = out.focus || "muscle"; out.targetWeight = t.target; }
    if (t.metric === "bodyfat" && t.target < t.start) { out.focus = out.focus || "cut"; out.targetBodyfat = t.target; }
    if (t.metric === "smm" && t.target > t.start) out.focus = out.focus || "muscle";
    if (m.area && !out.areas.includes(m.area)) out.areas.push(m.area);
  }
  return out;
}

// Kurzfassung für KI-Kontexte
export const targetsBrief = (list) => (list?.length ? list.map((t) => ({ ziel: t.name, start: t.startTxt || null, aktuell: t.curTxt || null, zielwert: t.targetTxt || null, bis: t.by, tage_uebrig: t.daysLeft, fortschritt_pct: t.progressPct ?? null, zeit_verstrichen_pct: t.timePct, status: t.status, noetig: t.perWeekTxt || null, notiz: t.note || null })) : null);

export const targetsOf = (goals, manual, all, today) => (goals?.targets || []).map((t) => targetStatus(t, manual, all, today)).sort((a, b) => (a.by < b.by ? -1 : 1));
// Aktueller Stand je Messgrösse (für das Formular)
export function currentValues(manual, all) {
  const out = {};
  for (const k of Object.keys(TARGET_METRICS)) { if (k === "free") continue; const s = seriesOf(k, manual, all); if (s.length) out[k] = fmtVal(k, smooth(k, s)); }
  return out;
}
