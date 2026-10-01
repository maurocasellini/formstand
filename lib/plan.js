// Periodisierung und Wochenplan aus Zielen, Wettkämpfen, Verfügbarkeit und Schwächen.
// Rein rechnerisch (keine Datenbank, keine KI): gleiche Eingaben → gleicher Plan.
import { EVENT_TYPES, WEAKNESSES, pace } from "./catalog";

const iso = (d) => d.toISOString().slice(0, 10);
const addD = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const diff = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 864e5);
export const mondayOf = (day) => { const d = new Date(day + "T00:00:00Z"); return addD(day, -((d.getUTCDay() + 6) % 7)); };
const W = (ftp, a, b) => (ftp ? ` (${Math.round(ftp * a)}–${Math.round(ftp * b)} W)` : "");
const H = (lthr, a, b) => (lthr ? ` (${Math.round(lthr * a)}–${Math.round(lthr * b)} bpm)` : "");
export const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const PHASES = {
  base: "Grundlage", build: "Aufbau", peak: "Wettkampfspezifisch", taper: "Tapering", raceweek: "Wettkampfwoche", race: "Wettkampftag",
  recovery: "Erholung nach Wettkampf", maintain: "Form halten", strength: "Kraftblock", health: "Gesund & fit",
};

// Phase für einen Tag: richtet sich nach dem nächsten wichtigen Wettkampf
export function phaseFor(goals, day) {
  const evs = (goals.events || []).filter((e) => e.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const past = evs.filter((e) => e.priority !== "C" && diff(day, e.date) >= 1 && diff(day, e.date) <= (e.priority === "A" ? 6 : 3)).pop();
  if (past) return { phase: "recovery", label: `${PHASES.recovery}: ${past.name}`, event: past, daysTo: -diff(day, past.date) };
  const upcoming = evs.filter((e) => e.date >= day);
  const nextA = upcoming.find((e) => e.priority === "A" && diff(e.date, day) <= 210);
  const target = nextA || upcoming.find((e) => diff(e.date, day) <= 84) || null;
  if (!target) {
    const p = goals.focus === "muscle" ? "strength" : goals.focus === "maintain" ? "maintain" : goals.focus === "health" || goals.focus === "cut" ? "health" : "base";
    return { phase: p, label: PHASES[p], event: null, daysTo: null };
  }
  const d = diff(target.date, day), A = target.priority === "A";
  const phase = d === 0 ? "race" : d <= (A ? 6 : 2) ? "raceweek" : A && d <= 13 ? "taper" : d <= 56 ? "peak" : d <= 112 ? "build" : "base";
  return { phase, label: PHASES[phase], event: target, daysTo: d, weeksTo: Math.ceil(d / 7) };
}

function sportsFor(goals, profile, event) {
  const ev = event ? EVENT_TYPES[event.type]?.[1] : null;
  if (ev && ev !== "other") return ev;
  const s = String(profile.sport || "");
  if (/tri/i.test(s)) return "tri";
  if (/hyrox/i.test(s)) return "hyrox";
  if (/rad/i.test(s) && /lauf/i.test(s)) return "mix";
  if (/lauf/i.test(s)) return "run";
  if (/kraft/i.test(s)) return "strength";
  return "bike";
}

// ---------- Einheiten-Bibliothek ----------
function quality(kind0, sport, z, phase, event) {
  let kind = kind0;
  const { ftp, lthr } = z;
  const bike = {
    sweetspot: ["Sweet Spot", `15 min einfahren, 3×12 min${W(ftp, 0.88, 0.93)} mit 5 min locker, ausfahren.`, 70],
    schwelle: ["Schwelle", `15 min einfahren, 4×8 min${W(ftp, 0.95, 1.03)} mit 4 min locker, ausfahren.`, 75],
    vo2: ["VO2max", `15 min einfahren, 5×4 min${W(ftp, 1.06, 1.18)} mit 4 min locker, ausfahren.`, 65],
    sprint: ["Sprints & Antritte", `20 min einfahren, 8×30 s maximal mit 4:30 min locker, dazu 2×8 min${W(ftp, 0.9, 0.95)}.`, 75],
    klettern: ["Bergintervalle", `15 min einfahren, 5×6 min${W(ftp, 0.9, 1.0)} bei 55–65 U/min (Anstieg oder Rolle), 4 min locker.`, 80],
    langstrecke: ["Tempo lang", `2×25 min${W(ftp, 0.8, 0.88)} mit 10 min locker, dabei 60–80 g Kohlenhydrate pro Stunde üben.`, 90],
    grundlage: ["Tempo-Grundlage", `90 min Zone 2${W(ftp, 0.65, 0.75)} mit 3×10 min oberer Bereich${W(ftp, 0.76, 0.85)}.`, 90],
  };
  const run = {
    sweetspot: ["Tempodauerlauf", `15 min einlaufen, 2×15 min zügig${H(lthr, 0.9, 0.94)} mit 3 min Trab, auslaufen.`, 60],
    schwelle: ["Schwellenlauf", `15 min einlaufen, 3×10 min${H(lthr, 0.95, 1.0)} mit 3 min Trab, auslaufen.`, 60],
    vo2: ["VO2max-Intervalle", `15 min einlaufen, 6×3 min sehr hart${lthr ? ` (über ${Math.round(lthr * 1.02)} bpm)` : ""} mit 2 min Trab, auslaufen.`, 55],
    lauftempo: ["Tempo & Ökonomie", `15 min einlaufen, 8×400 m im 5-km-Tempo mit 200 m Trab, 6 Steigerungen, auslaufen.`, 55],
    sprint: ["Bergsprints", `20 min einlaufen, 10×12 s Bergsprint maximal mit voller Erholung, 15 min locker.`, 50],
    klettern: ["Bergläufe", `15 min einlaufen, 6×4 min bergauf hart mit Trab bergab, auslaufen.`, 60],
    langstrecke: ["Langer Tempolauf", `20 min locker, 2×20 min im Wettkampftempo, Gels unterwegs üben.`, 85],
    grundlage: ["Lockerer Fahrtspiel", `60 min locker mit 6×2 min zügig nach Gefühl.`, 60],
  };
  // Wettkampfspezifisch in der Peak-Phase
  if (phase === "peak" && event && kind0 === "__race") {
    const t = event.type;
    if (t === "rad_marathon") return { sport: "bike", t: "Renntempo Granfondo", d: `20 min einfahren, 2×30 min${W(ftp, 0.8, 0.86)} mit je 3×1 min Attacken${W(ftp, 1.2, 1.3)}, Verpflegung wie im Rennen.`, min: 100 };
    if (t === "rad_rennen") return { sport: "bike", t: "Rennsimulation", d: `15 min einfahren, 3×10 min${W(ftp, 1.0, 1.05)} in Rennposition, 5 min locker.`, min: 70 };
    if (t === "gravel") return { sport: "bike", t: "Over-Unders", d: `15 min einfahren, 4×8 min wechselnd 1 min${W(ftp, 1.05, 1.1)} / 1 min${W(ftp, 0.88, 0.92)}.`, min: 70 };
    if (t === "lauf_10k") return { sport: "run", t: "10-km-Tempo", d: `15 min einlaufen, 5×1 km im 10-km-Wettkampftempo mit 2 min Trab, auslaufen.`, min: 55 };
    if (t === "lauf_hm") return { sport: "run", t: "HM-Tempo", d: `15 min einlaufen, 3×3 km im Halbmarathon-Tempo mit 3 min Trab, auslaufen.`, min: 70 };
    if (t === "lauf_m") return { sport: "run", t: "Marathon-Tempo", d: `20 min einlaufen, 2×6 km im Marathontempo mit 5 min Trab, Gels üben.`, min: 95 };
    if (t === "trail") return { sport: "run", t: "Bergspezifisch", d: `15 min einlaufen, 3×10 min bergauf im Wettkampftempo, bergab locker technisch.`, min: 75 };
    if (t === "tri_kurz") return { sport: "bike", t: "Koppel-Intervalle", d: `15 min einfahren, 3× (10 min Rad${W(ftp, 0.95, 1.0)} + direkt 5 min Lauf im Wettkampftempo), 5 min locker zwischen den Blöcken.`, min: 85 };
    if (t === "tri_lang") return { sport: "bike", t: "Renntempo Langdistanz", d: `20 min einfahren, 2×40 min${W(ftp, 0.72, 0.8)} in Aeroposition, Verpflegung wie im Rennen (60–90 g/h), danach 15 min Lauf locker.`, min: 135 };
    if (t === "hyrox") return { sport: "hyrox", t: "HYROX-Simulation", d: `4 Runden: 1 km Lauf im Wettkampftempo + Station (Sled Push 25 m / Wall Balls 25 / Burpee Broad Jumps 20 m / Rudern 500 m).`, min: 60 };
  }
  if (sport === "hyrox" && (kind === "hyrox_stationen" || kind === "vo2")) return { sport: "hyrox", t: "HYROX-Kombi", d: `4 Runden: 1 km Lauf zügig + Station (Wall Balls 20 / Sled 25 m / Lunges 20 m / Ski 250 m), 2 min Pause.`, min: 55 };
  const s = sport === "run" ? "run" : "bike";
  const lib = s === "run" ? run : bike;
  const x = lib[kind] || lib.schwelle;
  return { sport: s, t: x[0], d: x[1], min: x[2] };
}

function strength(region, phase, weak) {
  if (weak.includes("hyrox_stationen")) return { t: "Kraftausdauer HYROX", d: "Sled Push/Pull, Wall Balls, Lunges, Farmer's Carry – 4 Runden, kurze Pausen.", region: "full", min: 50 };
  const light = phase === "peak" || phase === "taper";
  const vol = light ? "2 Sätze, schwer, wenig Wiederholungen (Erhaltung)" : "4 Sätze, RIR 2";
  if (region === "legs") return { t: "Kraft Beine", d: `Kniebeuge, Kreuzheben rumänisch, Bulgarian Split Squat, Wadenheben – ${vol}.`, region: "legs", min: light ? 40 : 55 };
  if (region === "upper") return { t: "Kraft Oberkörper", d: `Bankdrücken/Liegestütz, Klimmzug/Rudern, Schulterdrücken, Rumpf – ${vol}.`, region: "upper", min: light ? 35 : 50 };
  return { t: "Kraft Ganzkörper", d: `Kniebeuge, Hip Thrust, Rudern, Drücken, Rumpf – ${vol}.`, region: "full", min: light ? 40 : 55 };
}

// ---------- Schwimmen (Pace relativ zur CSS, Sekunden pro 100 m) ----------
function swim(kind, css, phase, event) {
  const p = (x) => (css ? ` @ ${pace(css + x)}/100 m` : "");
  const lib = {
    technik: ["Schwimmen Technik", `300 m ein, 8×50 m Technikübungen (Abschlag, Faust, Zählen) mit 20 s Pause, 6×100 m${p(10)} ruhig und sauber, 200 m aus.`, 45],
    css: ["Schwimmen CSS-Intervalle", `400 m ein, 10×100 m${p(0) || " an der Schwelle"} mit 15 s Pause, 200 m aus.`, 50],
    ausdauer: ["Schwimmen Ausdauer", `400 m ein, 3×400 m${p(6) || " gleichmässig zügig"} mit 30 s Pause, 200 m aus.`, 55],
    schnell: ["Schwimmen Tempo", `400 m ein, 12×50 m schnell${p(-5)} mit 20 s Pause, 4×100 m locker, 200 m aus.`, 45],
    freiwasser: ["Freiwasser-Skills", `400 m ein, 3×200 m mit Orientierung alle 6–8 Züge, 6 Wasserstarts mit 25 m Sprint, 4×100 m${p(4)}, wenn möglich im See oder mit Neopren.`, 50],
    locker: ["Schwimmen locker", `1000–1500 m ganz locker, Technik im Fokus.`, 35],
  };
  if (kind === "race" && event?.type === "tri_kurz") return { t: "Schwimmen Wettkampftempo", d: `400 m ein, 1500 m am Stück${p(2)}, 4×25 m Startsprint, 200 m aus.`, min: 50 };
  if (kind === "race" && event?.type === "tri_lang") return { t: "Schwimmen Wettkampftempo lang", d: `400 m ein, 3×1000 m${p(5)} mit 45 s Pause, wenn möglich mit Neopren, 200 m aus.`, min: 75 };
  const x = lib[kind] || lib.ausdauer;
  return { t: x[0], d: x[1], min: x[2] };
}

// ---------- Wochenplan ----------
export function weekPlan(goals, monday, profile = {}, zones = {}) {
  const ph = phaseFor(goals, addD(monday, 3));
  const weak = [goals.mainWeakness, ...(goals.weaknesses || [])].filter((w, i, a) => w && WEAKNESSES[w] && a.indexOf(w) === i);
  const sport = sportsFor(goals, profile, ph.event);
  const D = Math.max(2, Math.min(7, Number(goals.daysPerWeek) || 5));
  const swimsPlanned = (sportsFor(goals, profile, ph.event) === "tri" || weak.includes("schwimmen")) ? (Number(goals.swimsPerWeek) || 2.5) : 0;
  const budget = Math.max(2, Math.min(25, Number(goals.hoursPerWeek) || 7)) * 60 - Math.min(swimsPlanned * 50, (Number(goals.hoursPerWeek) || 7) * 60 * 0.3);
  const L = Number.isInteger(Number(goals.longDay)) ? Number(goals.longDay) : 6;
  const lifts = /kraft|hyrox|crossfit/i.test(String(profile.sport || "")) || weak.some((w) => /kraft|rumpf|hyrox/.test(w)) || goals.focus === "muscle" || sport === "strength";

  // Ruhetage
  const rest = new Set();
  for (const d of [0, 4, 2, 3, 1, 5, 6]) { if (rest.size >= 7 - D) break; if (d !== L) rest.add(d); }
  if (weak.includes("erholung") && rest.size < 3 && D > 3) rest.add([4, 2, 0].find((d) => !rest.has(d) && d !== L));

  let Q = { base: 1, build: 2, peak: 2, taper: 1, raceweek: 1, recovery: 0, maintain: 1, strength: 0, health: 1 }[ph.phase] ?? 1;
  let S = !lifts ? 0 : { base: 2, build: 2, peak: 1, taper: 1, raceweek: 0, recovery: 0, maintain: 1, strength: 3, health: 2 }[ph.phase] ?? 1;
  if (goals.focus === "muscle") { S = Math.max(S, 3); Q = Math.min(Q, 1); }
  if (D <= 3) { Q = Math.min(Q, 1); S = Math.min(S, 1); }
  const scale = ph.phase === "taper" ? 0.6 : ph.phase === "raceweek" ? 0.45 : ph.phase === "recovery" ? 0.4 : 1;

  const train = [0, 1, 2, 3, 4, 5, 6].filter((d) => !rest.has(d));
  const slot = {};
  const hasLong = train.includes(L) && !["raceweek", "recovery", "race"].includes(ph.phase) && goals.focus !== "muscle";
  if (hasLong) slot[L] = "long";
  const qPref = [1, 3, 2, 5, 4, 0, 6].filter((d) => train.includes(d) && !slot[d]);
  for (const d of qPref) { if (Object.values(slot).filter((x) => x === "quality").length >= Q) break; if (slot[d - 1] === "quality" || slot[d + 1] === "quality") continue; slot[d] = "quality"; }
  // Kraft bevorzugt NICHT am Tag vor einer harten oder langen Einheit
  const hardNext = (d) => slot[d + 1] === "quality" || slot[d + 1] === "long";
  const sPref = [0, 2, 4, 5, 3, 6, 1].filter((d) => train.includes(d) && !slot[d]).sort((a, b) => hardNext(a) - hardNext(b));
  for (const d of sPref) { if (Object.values(slot).filter((x) => x === "strength").length >= S) break; slot[d] = "strength"; }
  for (const d of train) if (!slot[d]) slot[d] = "easy";

  // Minuten verteilen
  const qMin = Math.min(100, Math.max(50, budget * 0.17)), sMin = goals.focus === "muscle" ? 60 : 50;
  const longMin = hasLong ? Math.round(Math.min(330, budget * (ph.phase === "peak" ? 0.32 : 0.3) * (weak.includes("grundlage") || weak.includes("langstrecke") ? 1.15 : 1))) : 0;
  const nq = Object.values(slot).filter((x) => x === "quality").length, ns = Object.values(slot).filter((x) => x === "strength").length, ne = Object.values(slot).filter((x) => x === "easy").length;
  const easyMin = ne ? Math.max(30, Math.min(120, (budget - longMin - nq * qMin - ns * sMin) / ne)) : 0;

  const endWeak = weak.filter((w) => ["schwelle", "vo2", "sprint", "klettern", "lauftempo", "langstrecke", "grundlage", "hyrox_stationen"].includes(w));
  const defaultQ = { base: ["sweetspot", "schwelle"], build: ["schwelle", "vo2"], peak: ["schwelle", "vo2"], taper: ["schwelle"], raceweek: ["schwelle"], maintain: ["schwelle"], health: ["sweetspot"], strength: ["schwelle"] }[ph.phase] || ["schwelle"];
  const strWeak = weak.filter((w) => w === "kraft_beine" || w === "kraft_ober");
  let qi = 0, si = 0, extras = 0, easyIdx = 0;
  const out = [];
  for (let d = 0; d < 7; d++) {
    const day = addD(monday, d), phD = phaseFor(goals, day);
    let it;
    const evToday = (goals.events || []).find((e) => e.date === day), evTomorrow = (goals.events || []).find((e) => e.date === addD(day, 1) && e.priority !== "C");
    if (evToday) it = { type: "race", title: `Wettkampf: ${evToday.name}`, detail: `${evToday.target ? `Ziel: ${evToday.target}. ` : ""}15–20 min einrollen mit 2×1 min zügig, dann los. Viel Erfolg!`, min: 0, sport: EVENT_TYPES[evToday.type]?.[1] || sport };
    else if (evTomorrow && phD.phase !== "raceweek") it = { type: "opener", title: `Aktivierung vor ${evTomorrow.name}`, detail: "30 min locker mit 3×1 min zügig. Früh ins Bett.", min: 30, sport };
    else if (phD.phase === "raceweek" && phD.daysTo === 1) it = { type: "opener", title: "Aktivierung", detail: "30 min locker mit 3×1 min zügig. Früh ins Bett, Material und Verpflegung bereit.", min: 30, sport };
    else if (phD.phase === "raceweek" && phD.daysTo === 2) it = { type: "rest", title: "Ruhetag vor dem Wettkampf", detail: "Pause, viel trinken, Kohlenhydrate hoch (6–8 g/kg).", min: 0 };
    else if (phD.phase === "recovery") it = slot[d] && d % 2 === 0 ? { type: "easy", title: "Erholung aktiv", detail: "30–45 min ganz locker oder Spaziergang. Keine Intensität.", min: 40, sport } : { type: "rest", title: "Erholung", detail: "Pause nach dem Wettkampf.", min: 0 };
    else if (!slot[d]) it = { type: "rest", title: "Ruhetag", detail: weak.includes("mobilitaet") ? "15 min Mobility, sonst Pause." : "Pause.", min: 0 };
    else if (slot[d] === "long") {
      const run = sport === "run" || (sport === "tri" && d === 6 && L !== 5) || (sport === "hyrox");
      const m = Math.round(longMin * scale);
      const add = [weak.includes("langstrecke") ? "Verpflegung üben: 60–80 g Kohlenhydrate pro Stunde" : null, weak.includes("klettern") && !run ? "mit 2–3 längeren Anstiegen im oberen Zone-2-Bereich" : null, ph.phase === "peak" && ph.event && /lauf_m|lauf_hm/.test(ph.event.type) ? "letzte 20 min im Wettkampftempo" : null].filter(Boolean);
      it = { type: "long", sport: run ? "run" : "bike", title: run ? "Langer Lauf" : "Lange Ausfahrt", detail: `${m} min Zone 2${run ? H(zones.lthr, 0.8, 0.88) : W(zones.ftp, 0.56, 0.75)}${add.length ? ". " + add.map((x) => x[0].toUpperCase() + x.slice(1)).join(". ") : ""}.`, min: m, focus: weak.includes("grundlage") ? "grundlage" : weak.includes("langstrecke") ? "langstrecke" : null };
    } else if (slot[d] === "quality") {
      const kind = ph.phase === "peak" && ph.event && qi === 0 ? "__race" : endWeak[ph.phase === "peak" && ph.event ? qi - 1 : qi] || endWeak[0] || defaultQ[qi % defaultQ.length] || "schwelle";
      const sp = sport === "tri" || sport === "mix" ? (qi % 2 === 0 ? "bike" : "run") : sport === "hyrox" ? (qi % 2 === 0 ? "run" : "hyrox") : sport === "strength" ? "bike" : sport;
      const q = quality(ph.phase === "raceweek" ? "schwelle" : kind, sp, zones, ph.phase, ph.event);
      const short = ph.phase === "taper" || ph.phase === "raceweek";
      it = { type: "quality", sport: q.sport, title: q.t + (short ? " (kurz)" : ""), detail: short ? q.d.replace(/(\d)×/, (m0, n) => `${Math.max(2, Math.ceil(n / 2))}×`) : q.d, min: Math.round(q.min * (short ? 0.7 : 1)), focus: weak.includes(kind) ? kind : null };
      qi++;
    } else if (slot[d] === "strength") {
      let region = strWeak.length ? (strWeak[si % strWeak.length] === "kraft_beine" ? "legs" : "upper") : si % 2 === 0 ? "full" : "upper";
      if (hardNext(d) && region !== "upper") region = "upper"; // Beine frisch halten für morgen
      const s = strength(region, ph.phase, weak);
      it = { type: "strength", title: s.t, detail: s.d + (weak.includes("rumpf") ? " Plus 10 min Rumpf." : ""), min: s.min, region: s.region, focus: s.region === "legs" && weak.includes("kraft_beine") ? "kraft_beine" : s.region === "upper" && weak.includes("kraft_ober") ? "kraft_ober" : weak.includes("hyrox_stationen") ? "hyrox_stationen" : weak.includes("rumpf") ? "rumpf" : null };
      si++;
    } else {
      const run = sport === "run" || ((sport === "tri" || sport === "mix") && easyIdx++ % 2 === 0);
      const m = Math.round(easyMin * scale);
      const ex = extras++ < 2;
      const add = [weak.includes("sprint") && !run ? "dazu 6×15 s Sprints" : null, weak.includes("lauftempo") && run ? "dazu 6 Steigerungen" : null, weak.includes("rumpf") && ex ? "danach 15 min Rumpf" : null, weak.includes("mobilitaet") && ex ? "danach 10 min Mobility" : null].filter(Boolean);
      it = { type: "easy", sport: run ? "run" : "bike", title: run ? "Lockerer Lauf" : "Grundlage Rad", detail: `${m} min Zone 2${run ? H(zones.lthr, 0.8, 0.88) : W(zones.ftp, 0.56, 0.72)}${add.length ? ", " + add.join(", ") : ""}.`, min: m, focus: add.length ? (weak.includes("sprint") ? "sprint" : weak.includes("rumpf") ? "rumpf" : weak.includes("mobilitaet") ? "mobilitaet" : null) : null };
    }
    out.push({ day, dow: d, phase: phD.phase, ...it });
  }
  // Schwimmen: bei Triathlon (oder Schwäche "Schwimmen") als zweite Einheit an lockeren Tagen
  const swims = sport === "tri" || weak.includes("schwimmen") || weak.includes("freiwasser");
  if (swims) {
    let n = Number(goals.swimsPerWeek) || (sport === "tri" ? { base: 2, build: 3, peak: 3, taper: 2, raceweek: 1, recovery: 1 }[ph.phase] ?? 2 : 2);
    if (!goals.swimsPerWeek && weak.includes("schwimmen") && sport === "tri") n = Math.min(4, n + 1);
    const rot = ph.phase === "recovery" ? ["locker"] : ph.phase === "raceweek" ? ["technik"] : ph.phase === "taper" ? ["css", "technik"]
      : ph.phase === "peak" ? ["race", "css", "technik", "ausdauer"] : ph.phase === "build" ? ["css", "ausdauer", "schnell", "technik"] : ["technik", "ausdauer", "css", "technik"];
    if (weak.includes("schwimmen") && !rot.slice(0, n).includes("technik")) rot.splice(1, 0, "technik");
    if (weak.includes("freiwasser") && ["build", "peak"].includes(ph.phase)) rot.splice(1, 0, "freiwasser");
    const fit = (x) => x.type !== "race" && x.type !== "opener" && !(x.type === "rest" && x.title.includes("vor dem Wettkampf"));
    const order = [...out.filter((x) => x.type === "easy"), ...out.filter((x) => x.type === "strength"), ...out.filter((x) => x.type === "quality" && x.sport !== "run"), ...out.filter((x) => x.type === "rest")].filter(fit);
    for (let k = 0; k < n && k < order.length; k++) {
      const it = order[k];
      const sw = swim(it.type === "quality" ? "technik" : rot[k % rot.length], zones.css, ph.phase, ph.event), m = Math.round(sw.min * (scale < 1 ? Math.max(0.7, scale) : 1));
      const focus = weak.includes("schwimmen") ? "schwimmen" : weak.includes("freiwasser") && rot[k % rot.length] === "freiwasser" ? "freiwasser" : null;
      const sec = { sport: "swim", title: sw.t, detail: sw.d, min: m, focus };
      if (it.type === "rest") Object.assign(it, { type: "easy", sport: "swim", title: sw.t, detail: sw.d, min: m, focus });
      else it.second = sec;
    }
    // Koppeltraining am langen Tag (Aufbau/Wettkampfphase)
    if (sport === "tri" && ["build", "peak"].includes(ph.phase)) {
      const lg = out.find((x) => x.type === "long" && x.sport === "bike");
      if (lg) { lg.detail += ` Direkt danach ${ph.phase === "peak" ? 25 : 15} min Lauf, erste 5 min im Wettkampftempo (Koppeltraining).`; lg.min += ph.phase === "peak" ? 25 : 15; lg.focus2 = weak.includes("freiwasser") ? "freiwasser" : lg.focus2; }
    }
  }
  // Beinkraft ist Schwäche, passt aber nirgends ohne den nächsten harten Tag zu stören:
  // dann an den ersten Qualitätstag hängen ("harte Tage hart, lockere Tage locker")
  if (weak.includes("kraft_beine") && !["taper", "raceweek", "recovery"].includes(ph.phase) && !out.some((x) => x.region === "legs")) {
    const q = out.find((x) => x.type === "quality");
    if (q) { q.detail += " Danach 35 min Kraft Beine (Kniebeuge, Kreuzheben rumänisch, 3 Sätze, RIR 2)."; q.min += 35; q.region = "legs"; q.focus2 = "kraft_beine"; }
  }
  return { phase: ph, sport, items: out, hours: Math.round(out.reduce((s, x) => s + (x.min || 0) + (x.second?.min || 0), 0) / 6) / 10 };
}

export function planFor(goals, day, profile, zones) {
  if (!goals || (!goals.events?.length && !goals.weaknesses?.length && !goals.updated_at)) return null;
  return weekPlan(goals, mondayOf(day), profile, zones).items.find((x) => x.day === day) || null;
}
