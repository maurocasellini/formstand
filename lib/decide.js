// Entscheidungs-Engine: Aus Zuständen, Check-in, Belastung und Historie folgt EINE klare Entscheidung für heute.
// Feste Regeln, nachvollziehbar und testbar: gleiche Daten → gleiche Entscheidung. Die KI erklärt sie nur.
import { REGIONS } from "./state";
import { WEAKNESSES } from "./catalog";
const WEAK_NAMES = Object.fromEntries(Object.entries(WEAKNESSES).map(([k, v]) => [k, v[0]]));

const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const sdv = (a) => { const x = a.filter((v) => v != null); const m = mean(x); return x.length > 1 ? Math.sqrt(mean(x.map((v) => (v - m) ** 2))) : null; };
const W = (ftp, a, b) => (ftp ? `${Math.round(ftp * a)}–${Math.round(ftp * b)} W` : null);
const H = (lthr, a, b) => (lthr ? `${Math.round(lthr * a)}–${Math.round(lthr * b)} bpm` : null);

function daysSince(all, i, test) {
  for (let k = 1; k <= 21 && i - k >= 0; k++) if (test(all[i - k])) return k;
  return null;
}

// Infekt-Muster: Ruhepuls deutlich erhöht UND (Hauttemperatur oder Atemfrequenz erhöht)
function illnessFlag(all, i) {
  const T = all[i], prev = all.slice(Math.max(0, i - 28), i);
  const z = (k) => { const vals = prev.map((d) => d[k]); const m = mean(vals), s = sdv(vals); return T[k] != null && m != null && s ? (T[k] - m) / Math.max(s, k === "rhr" ? 1.5 : 0.3) : null; };
  const zr = z("rhr"), zresp = z("resp");
  return zr != null && zr > 1.5 && ((T.skinTemp != null && T.skinTemp >= 0.5) || (zresp != null && zresp > 1.5));
}

export function decide({ all, st, zones = {}, profile = {}, triggers = [], planned = null, phase = null }) {
  const i = all.length - 1, T = all[i];
  if (!T || !st) return null;
  const ck = T.checkin || null, S = st.states;
  const score = T.score, cardio = S.cardio.value ?? score, sleep = S.sleep.value, stress = S.stress.value;
  const legs = S.muscle.regions.legs.value, upper = S.muscle.regions.upper.value;
  const time = ck?.time_min ?? null;
  const cap = (std, min = 20) => (time ? Math.max(min, Math.min(std, time - 5)) : std);
  const ftp = zones.ftp, lthr = zones.lthr;
  const sport = String(profile.sport || "");
  const bikes = /rad|tri|ausdauer/i.test(sport) || Boolean(ftp) || !sport, runs = /lauf|tri|ausdauer|hyrox/i.test(sport) || !sport;
  const lifts = /kraft|hyrox|crossfit/i.test(sport) || all.slice(-30).some((d) => d.str > 0);

  const sinceHard = daysSince(all, i, (d) => (d.hardSessions || []).some((h) => h.category === "end"));
  const lastHard = all.slice(Math.max(0, i - 21), i).reverse().flatMap((d) => d.hardSessions || []).find((h) => h.category === "end");
  const sinceStr = daysSince(all, i, (d) => d.str > 0);
  const acwr = T.ctl > 10 ? T.atl / T.ctl : null;
  const ill = illnessFlag(all, i);
  const alc = (T.night || []).filter((t) => t.t === "alkohol").reduce((s, t) => s + (t.n || 1), 0);

  const why = [], avoid = [];
  const add = (x) => x && why.length < 5 && !why.includes(x) && why.push(x);
  let type, title, main, alt = null, tomorrow;

  if (score == null && cardio == null) return null;

  // 1. Kein Training geplant
  if (time === 0) {
    type = "rest"; title = "Trainingsfreier Tag";
    main = { what: "Kein Training", detail: "10 min Mobility am Abend, sonst Pause. Passt, du hast keine Zeit eingeplant.", min: 10 };
    tomorrow = "Morgen wieder normal planen, je nach Check-in.";
  }
  // 2. Infekt-Verdacht oder komplett leer
  else if (ill || ck?.energy === 1) {
    type = "rest"; title = ill ? "Ruhetag: Infekt-Muster" : "Ruhetag: Akku leer";
    main = { what: "Ruhetag", detail: "Kein Training. Viel trinken, früh schlafen. Bei Fieber oder Krankheitsgefühl auch morgen pausieren.", min: 0 };
    alt = { what: "Spaziergang", detail: "20–30 min draussen, nur wenn du dich gut fühlst." };
    if (ill) add("Ruhepuls deutlich erhöht, dazu Hauttemperatur oder Atemfrequenz: typisches Muster vor einem Infekt");
    if (ck?.energy === 1) add("Energie im Check-in 1/5");
    avoid.push("Jede Intensität", "Krafttraining");
    tomorrow = "Morgen erst wieder trainieren, wenn Ruhepuls und Energie zurück im Normalbereich sind.";
  }
  // 3. Erholung nötig
  else if ((score != null && score < 34) || cardio < 35) {
    type = "recovery"; title = "Erholung priorisieren";
    main = { what: bikes ? "Lockeres Ausrollen" : "Lockere Bewegung", detail: `${cap(35)} min Zone 1${ftp ? ` (unter ${Math.round(ftp * 0.55)} W)` : lthr ? ` (unter ${Math.round(lthr * 0.8)} bpm)` : ", Gespräch problemlos möglich"}, dazu 15 min Mobility.`, min: cap(35) + 15 };
    alt = { what: "Ruhetag", detail: "Komplette Pause ist heute genauso gut." };
    avoid.push("Intervalle", "Schweres Krafttraining");
    tomorrow = "Morgen Qualität nur, wenn HRV und Ruhepuls zurück im Normalbereich sind.";
  }
  // 4. Schlaf oder Stress limitieren
  else if ((sleep != null && sleep < 38) || (stress != null && stress < 35)) {
    const bySleep = sleep != null && sleep < 38;
    type = "easy"; title = bySleep ? "Locker – Schlaf fehlt" : "Locker – Kopf entlasten";
    main = { what: "Grundlage kurz", detail: `${cap(50)} min Zone 2${bikes && ftp ? ` (${W(ftp, 0.56, 0.7)})` : lthr ? ` (${H(lthr, 0.78, 0.86)})` : ""}, gleichmässig, gerne draussen.`, min: cap(50) };
    alt = { what: "Mobility & Spaziergang", detail: "30 min, wenn die Lust fehlt." };
    avoid.push("Intervalle und Maximalkraft", "Training spät am Abend");
    tomorrow = "Morgen Qualität möglich, wenn die Nacht besser ist.";
  }
  // 5. Belastungsspitze
  else if (acwr != null && acwr > 1.5) {
    type = "endurance"; title = "Grundlage – Belastungsspitze abbauen";
    main = { what: "Zone 2", detail: `${cap(60)} min Zone 2${bikes && ftp ? ` (${W(ftp, 0.56, 0.75)})` : lthr ? ` (${H(lthr, 0.8, 0.88)})` : ""}.`, min: cap(60) };
    avoid.push("Zusätzliche Intensität: die letzten 7 Tage liegen deutlich über deinem Schnitt");
    add(`Akute Last ${acwr.toFixed(1)}× deines 6-Wochen-Schnitts`);
    tomorrow = "Morgen entscheidet die Erholung: bei guter HRV wieder Qualität.";
  }
  // 6. Plan befolgen – sofern der Körper mitmacht
  else if (planned) {
    const P = planned, tcap = (m) => (m ? cap(m) : m);
    const okQ = cardio >= 55 && (score == null || score >= 50) && (sinceHard == null || sinceHard >= 2) && (!ck || ck.motivation >= 2) && (P.sport === "bike" ? legs >= 50 : legs >= 55);
    if (P.type === "race") {
      type = "race"; title = P.title; main = { what: "Wettkampf", detail: P.detail, min: 0 };
      tomorrow = "Morgen Erholung: locker oder Pause.";
    } else if (P.type === "rest") {
      type = "rest"; title = "Geplanter Ruhetag"; main = { what: P.title, detail: P.detail, min: 0 };
      tomorrow = "Morgen geht es nach Plan weiter.";
    } else if (P.type === "opener") {
      type = "easy"; title = P.title; main = { what: "Aktivierung", detail: P.detail, min: P.min };
      tomorrow = "Morgen ist Wettkampf.";
    } else if (P.type === "quality" && okQ) {
      type = "quality"; title = `Heute: ${P.title}`; main = { what: P.title, detail: P.detail, min: P.min };
      if (time && P.min > time) main.detail += ` Nur ${time} min Zeit: Einfahren kürzen und eine Wiederholung weniger.`;
      alt = { what: "Zone 2", detail: `${cap(60)} min locker, falls es sich beim Einfahren schwer anfühlt.` };
      if (sinceHard != null) add(`Letzte harte Ausdauereinheit vor ${sinceHard} Tagen`);
      if (P.focus && WEAK_NAMES[P.focus]) add(`Fokus auf deine Schwäche: ${WEAK_NAMES[P.focus]}`);
      tomorrow = "Morgen locker, damit die Qualität wirkt.";
    } else if (P.type === "quality") {
      type = "endurance"; title = "Qualität verschoben – heute locker";
      main = { what: "Zone 2", detail: `${cap(50)} min Zone 2${ftp ? ` (${W(ftp, 0.56, 0.7)})` : ""}.`, min: cap(50) };
      avoid.push(`Geplant war „${P.title}“ – heute zu früh`);
      add(cardio < 55 ? `Herz-Kreislauf ${cardio}/100 – für Intensität zu wenig` : legs < 55 ? `Beine ${legs}/100 – noch nicht frisch` : sinceHard != null && sinceHard < 2 ? `Harte Einheit erst vor ${sinceHard} Tag` : `Motivation ${ck?.motivation}/5`);
      tomorrow = `Morgen „${P.title}“ nachholen, wenn die Werte passen.`;
    } else if (P.type === "strength") {
      const need = P.region === "legs" ? legs : P.region === "upper" ? upper : Math.min(legs, upper);
      if (need >= 55) { type = "strength"; title = P.title; main = { what: P.title, detail: P.detail, min: tcap(P.min) }; if (P.focus && WEAK_NAMES[P.focus]) add(`Fokus auf deine Schwäche: ${WEAK_NAMES[P.focus]}`); }
      else if (P.region !== "upper" && upper >= 60) { type = "strength"; title = "Kraft Oberkörper statt Beine"; main = { what: "Kraft Oberkörper", detail: `${cap(45)} min: Drücken, Ziehen, Rumpf. 3–4 Sätze, RIR 2.`, min: cap(45) }; avoid.push(`Geplante Beinkraft – Beine ${legs}/100`); }
      else { type = "easy"; title = "Kraft verschoben – Mobility & locker"; main = { what: "Locker + Mobility", detail: `${cap(40)} min Zone 1–2 und 15 min Mobility.`, min: cap(40) + 15 }; avoid.push("Krafttraining heute – Muskulatur noch nicht erholt"); }
      tomorrow = "Morgen nach Plan.";
    } else {
      // Grundlage / lang
      const short = P.type === "long" && cardio < 50;
      type = P.type === "long" ? "endurance" : "endurance"; title = short ? `${P.title} – verkürzt` : P.title;
      const m = tcap(short ? Math.round(P.min * 0.7) : P.min);
      main = { what: P.title, detail: m !== P.min ? P.detail.replace(/^\d+ min/, `${m} min`) : P.detail, min: m };
      if (short) add(`Herz-Kreislauf ${cardio}/100 – lange Einheit um 30 % gekürzt`);
      if (P.focus && WEAK_NAMES[P.focus]) add(`Fokus auf deine Schwäche: ${WEAK_NAMES[P.focus]}`);
      tomorrow = "Morgen nach Plan.";
    }
    if (phase?.event && phase.daysTo > 0) add(`${phase.label}: noch ${phase.daysTo} Tage bis ${phase.event.name}`);
  }
  // 7. Qualität (ohne Plan)
  else if (cardio >= 58 && (score == null || score >= 55) && (sinceHard == null || sinceHard >= 2) && (!ck || ck.motivation >= 3)) {
    if (legs >= 55) {
      const runNext = runs && (!bikes || (lastHard && /bike|ride|rad|zwift/i.test(lastHard.name || "") && legs >= 70));
      const vo2 = cardio >= 68 && (sinceHard == null || sinceHard >= 3) && (time == null || time >= 50);
      type = "quality";
      if (!runNext) {
        title = vo2 ? "Heute: VO2max auf dem Rad" : "Heute: Schwelle auf dem Rad";
        main = vo2
          ? { what: "VO2max-Intervalle Rad", detail: `15 min einfahren, 5×4 min${ftp ? ` bei ${W(ftp, 1.06, 1.18)}` : " sehr hart (RPE 9)"} mit 4 min locker, 10 min ausfahren.`, min: 15 + 40 + 10 }
          : { what: "Schwellen-Intervalle Rad", detail: `15 min einfahren, ${time && time < 60 ? "3×8" : "4×8"} min${ftp ? ` bei ${W(ftp, 0.95, 1.03)}` : " hart (RPE 8)"} mit 4 min locker, 10 min ausfahren.`, min: time && time < 60 ? 61 : 73 };
      } else {
        title = vo2 ? "Heute: VO2max im Laufen" : "Heute: Schwelle im Laufen";
        main = vo2
          ? { what: "Laufintervalle", detail: `15 min einlaufen, 6×3 min${lthr ? ` bei über ${Math.round(lthr * 1.02)} bpm` : " sehr hart (RPE 9)"} mit 2 min Trabpause, 10 min auslaufen.`, min: 55 }
          : { what: "Schwellenlauf", detail: `15 min einlaufen, 3×10 min${lthr ? ` bei ${H(lthr, 0.95, 1.0)}` : " hart (RPE 8)"} mit 3 min Trabpause, 10 min auslaufen.`, min: 61 };
      }
      if (main.min > (time || 999)) main.detail += ` Passt nicht ganz in ${time} min: Ausfahren kürzen.`;
      alt = { what: "Zone 2", detail: `${cap(60)} min locker, falls es sich beim Einfahren schwer anfühlt.` };
      if (sinceHard != null) add(`Letzte harte Ausdauereinheit vor ${sinceHard} Tagen`);
      if (legs < 70) avoid.push("Zusätzlich schwere Beine im Kraftraum");
      tomorrow = "Morgen locker: Zone 1–2 oder Kraft Oberkörper.";
    } else if (upper >= 60 && lifts) {
      type = "strength"; title = "Kraft Oberkörper – Beine schonen";
      main = { what: "Kraft Oberkörper", detail: `${cap(50)} min: Drücken, Ziehen, Rumpf. 3–4 Sätze, RIR 2.`, min: cap(50) };
      alt = { what: "Lockeres Rad", detail: `${cap(40)} min Zone 1–2${ftp ? ` (${W(ftp, 0.5, 0.65)})` : ""} zum Durchspülen.` };
      avoid.push(`Schwere Beine: Kniebeugen, Kreuzheben, Sprünge, harte Läufe (${REGIONS.legs} ${legs}/100)`);
      tomorrow = "Morgen Qualität möglich, sobald die Beine wieder frei sind.";
    } else {
      type = "endurance"; title = "Grundlage – Muskeln erholen lassen";
      main = { what: "Zone 2 Rad", detail: `${cap(60)} min${ftp ? ` (${W(ftp, 0.56, 0.7)})` : ""}, hohe Trittfrequenz, wenig Kraft.`, min: cap(60) };
      avoid.push("Schwere Beine und Laufintervalle");
      tomorrow = "Morgen wieder Qualität, wenn die Beine frei sind.";
    }
  }
  // 7. Kraft fällig
  else if (lifts && (sinceStr == null || sinceStr >= 3) && (score == null || score >= 50) && (legs >= 65 || upper >= 65)) {
    const lower = legs >= 70 && (sinceHard == null || sinceHard >= 1);
    type = "strength"; title = lower ? "Kraft Beine & Rumpf" : "Kraft Oberkörper";
    main = { what: title, detail: lower ? `${cap(55)} min: Kniebeuge, Kreuzheben, Ausfallschritte, Rumpf. 4 Sätze, RIR 2.` : `${cap(50)} min: Drücken, Ziehen, Rumpf. 3–4 Sätze, RIR 2.`, min: cap(55) };
    alt = { what: "Zone 2", detail: `${cap(50)} min locker.` };
    if (sinceStr != null) add(`Letztes Krafttraining vor ${sinceStr} Tagen`);
    tomorrow = lower ? "Morgen keine harten Beine; Rad locker ist okay." : "Morgen Qualität möglich.";
  }
  // 8. Standard: Grundlage
  else {
    type = "endurance"; title = "Grundlage";
    const run = runs && !bikes;
    main = { what: run ? "Lockerer Dauerlauf" : "Zone 2 Rad", detail: `${cap(75)} min Zone 2${!run && ftp ? ` (${W(ftp, 0.56, 0.75)})` : lthr ? ` (${H(lthr, 0.8, 0.88)})` : ""}.`, min: cap(75) };
    alt = { what: "Kürzer", detail: `${cap(40)} min, falls die Zeit knapp ist.` };
    if (sinceHard != null && sinceHard < 2) add(`Harte Einheit erst vor ${sinceHard} Tag${sinceHard > 1 ? "en" : ""}`);
    if (ck && ck.motivation < 3) add(`Motivation ${ck.motivation}/5 – heute ohne Druck`);
    tomorrow = "Morgen Qualität möglich, wenn die Werte passen.";
  }

  // Allgemeine Vermeidungen
  if (alc && type === "quality") avoid.push("Maximalbelastung nach Alkohol – Intensität eher am unteren Rand halten");
  if (legs < 50 && !avoid.some((a) => /Beine/.test(a))) avoid.push(`Schwere Beine (${REGIONS.legs} ${legs}/100)`);

  // Begründung: Treiber, Limiter, Trigger-Erfahrung, Check-in
  for (const d of st.drivers) add(d);
  if (st.limiter) add(`Limiter ${st.limiter.name}${st.limiter.why ? `: ${st.limiter.why}` : ""}`);
  for (const t of T.night || []) { const r = triggers.find((x) => x.k === t.t); if (r?.metrics?.hrv?.diff != null && r.level !== "zu wenig Daten") add(`${r.name} gestern: bei dir im Schnitt HRV ${r.metrics.hrv.diff > 0 ? "+" : "−"}${Math.abs(Math.round(r.metrics.hrv.diff))} %${r.recovery != null ? `, normal nach Ø ${r.recovery.toFixed(1)} Tagen` : ""}`); }
  if (time) add(`Zeit heute: ${time} min`);

  const state = type === "quality" || type === "race" ? "good" : type === "rest" || type === "recovery" ? "crit" : "warn";
  const nutrition = fuel(type, main.min || 0, Number(profile.weight_kg) || 75);
  const key = [T.day, type, title, main.min, ck ? 1 : 0].join("|");
  return { key, planned: planned ? { type: planned.type, title: planned.title, focus: planned.focus || null, focus2: planned.focus2 || null } : null, type, state, title, main, alt, avoid: [...new Set(avoid)].slice(0, 3), why, tomorrow, nutrition, quality: st.quality.level };
}

// Ernährung passend zur geplanten Einheit ("fuel for the work required")
export function fuel(type, minutes, kg) {
  if (type === "race") return { carbs_gkg: 7, carbs_g: Math.round((7 * kg) / 10) * 10, protein_g: Math.round((1.6 * kg) / 5) * 5, fluid_l: Math.round((0.035 * kg + 1.5) * 10) / 10,
    pre: `2–3 h vorher ${Math.round(kg * 1.5 / 10) * 10} g Kohlenhydrate (bekanntes Frühstück, nichts Neues)`, during: "60–90 g Kohlenhydrate pro Stunde, ab der ersten halben Stunde", post: `innert 1 h ${Math.round(kg * 0.4 / 5) * 5} g Protein + ${Math.round(kg / 10) * 10} g Kohlenhydrate` };
  const long = minutes > 120, hard = type === "quality";
  const gkg = type === "rest" || type === "recovery" ? 3 : type === "easy" ? 3.5 : type === "strength" ? 4 : hard ? (long ? 7 : 5.5) : minutes <= 75 ? 4 : long ? 6.5 : 5;
  const carbs = Math.round((gkg * kg) / 10) * 10;
  const protein = Math.round((type === "strength" ? 2.0 : 1.7) * kg / 5) * 5;
  const fluid = Math.round((0.035 * kg + (minutes / 60) * 0.6) * 10) / 10;
  return {
    carbs_gkg: gkg, carbs_g: carbs, protein_g: protein, fluid_l: fluid,
    pre: hard || long ? "60–90 min vorher 30–60 g Kohlenhydrate (z. B. Banane + Toast)" : null,
    during: minutes > 150 ? "60–90 g Kohlenhydrate pro Stunde" : minutes > 75 ? "30–60 g Kohlenhydrate pro Stunde" : null,
    post: type === "rest" ? null : `innert 1 h ${Math.round(kg * 0.4 / 5) * 5} g Protein${hard || long ? ` + ${Math.round(kg / 10) * 10} g Kohlenhydrate` : ""}`,
  };
}
