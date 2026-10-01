// Zustände statt einer einzigen Zahl: Herz-Kreislauf, Muskulatur, Schlaf, Stress.
// Jeder Zustand 0–100 gegen die persönliche Baseline, mit Treibern in Klartext.
// Dazu: Datenqualität (wie viele Signale vorliegen) und persönliche Einordnung jedes Werts.

const mean = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const sd = (a) => { const x = a.filter((v) => v != null); const m = mean(x); return x.length > 1 ? Math.sqrt(mean(x.map((v) => (v - m) ** 2))) || 1 : 1; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sgn = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;

export const REGIONS = { legs: "Beine", upper: "Oberkörper", core: "Rumpf" };
export const STATE_NAMES = { cardio: "Herz-Kreislauf", muscle: "Muskulatur", sleep: "Schlaf", stress: "Stress & Energie" };

// Gewichtete z-Werte → 0–100 (55 = persönlicher Normalzustand)
function combine(parts) {
  const p = parts.filter((x) => x.z != null && Number.isFinite(x.z));
  if (!p.length) return null;
  const w = p.reduce((s, x) => s + x.w, 0);
  return Math.round(clamp(55 + (p.reduce((s, x) => s + x.w * clamp(x.z, -2.5, 2.5), 0) / w) * 20, 1, 99));
}

// Mindest-Streuung je Wert: verhindert, dass winzige Abweichungen bei sehr gleichmässigen Daten übergross wirken
const SD_FLOOR = { hrv: 0.05, rhr: 1.5, sleep: 0.35, sleepScore: 4, stress: 3, bbHigh: 5 };
function baseline(days, i, key, n = 28) {
  const vals = days.slice(Math.max(0, i - n), i).map((d) => d[key]).filter((v) => v != null);
  if (vals.length < 5) return null;
  const m = mean(vals), f = SD_FLOOR[key];
  return { m, sd: Math.max(sd(vals), f == null ? 0 : key === "hrv" ? f * m : f), n: vals.length };
}

// Muskuläre Ermüdung je Bereich: Last der letzten 5 Tage mit Abklingen, relativ zum eigenen 90-Tage-Hoch (P90)
function fatigue(days, i, r) {
  let f = 0;
  for (let k = 0; k <= 4 && i - k >= 0; k++) f += (days[i - k].mus?.[r] || 0) * Math.exp(-k / 1.5);
  return f;
}
function fatigueRef(days, i, r) {
  const hist = [];
  for (let j = Math.max(5, i - 90); j < i; j++) hist.push(fatigue(days, j, r));
  const s = hist.filter((v) => v > 0).sort((a, b) => a - b);
  return s.length >= 8 ? s[Math.floor(s.length * 0.9)] : null;
}

export function computeStates(days, i = days.length - 1) {
  const T = days[i];
  if (!T) return null;
  const c = T.checkin || null;
  const out = {};

  // Herz-Kreislauf: HRV, Ruhepuls, akute vs. chronische Ausdauerlast, Energie
  {
    const parts = [], drivers = [];
    const bh = baseline(days, i, "hrv"), br = baseline(days, i, "rhr");
    if (T.hrv != null && bh) { const z = (Math.log(T.hrv) - Math.log(bh.m)) / (bh.sd / bh.m); parts.push({ w: 0.4, z }); drivers.push({ t: `HRV ${sgn(((T.hrv / bh.m) - 1) * 100)} % vs. Ø 28 T`, z }); }
    if (T.rhr != null && br) { const z = -(T.rhr - br.m) / br.sd; parts.push({ w: 0.3, z }); drivers.push({ t: `Ruhepuls ${sgn(T.rhr - br.m)} bpm vs. Ø 28 T`, z }); }
    if (T.ctlE > 5) { const ratio = T.atlE / T.ctlE, z = clamp((1.1 - ratio) * 2.5, -2, 2); parts.push({ w: 0.15, z }); drivers.push({ t: `Ausdauerlast 7 T ${ratio.toFixed(1)}× des Monatsschnitts`, z }); }
    if (c?.energy) { const z = c.energy - 3; parts.push({ w: 0.15, z }); drivers.push({ t: `Energie ${c.energy}/5`, z }); }
    out.cardio = { value: combine(parts), drivers, signals: parts.length };
  }

  // Muskulatur: je Bereich Modell aus Last (+ Muskelkater aus Check-in, wenn vorhanden)
  {
    const regions = {}, drivers = [];
    for (const r of Object.keys(REGIONS)) {
      const f = fatigue(days, i, r), ref = fatigueRef(days, i, r);
      const ratio = ref ? f / ref : f > 0 ? Math.min(1.2, f / 400) : 0;
      let v = Math.round(clamp(100 - ratio * 55, 5, 98));
      const sore = c?.soreness?.[r];
      if (sore != null && sore !== "") v = Math.round(0.4 * v + 0.6 * [92, 70, 45, 20][Number(sore)]);
      regions[r] = { value: v, ratio, sore: sore ?? null };
    }
    const worst = Object.entries(regions).sort((a, b) => a[1].value - b[1].value)[0];
    const hard = days.slice(Math.max(0, i - 3), i + 1).flatMap((d) => d.hardSessions || []);
    for (const [r, x] of Object.entries(regions)) {
      if (x.sore) drivers.push({ t: `Muskelkater ${REGIONS[r]} ${x.sore}/3`, z: -x.sore, r });
      if (x.ratio > 0.8) drivers.push({ t: `${REGIONS[r]}: hohe Last in den letzten Tagen (${Math.round(x.ratio * 100)} % deines Hochs)`, z: -1.5 * Math.min(1.5, x.ratio), r });
    }
    if (!drivers.length) drivers.push({ t: "Keine auffällige Muskelbelastung", z: 0.5 });
    out.muscle = { value: worst ? worst[1].value : null, regions, limiter: worst ? worst[0] : null, drivers, signals: c?.soreness ? 2 : 1, hard };
  }

  // Schlaf: Dauer und Score gegen Baseline, Schlafschuld der letzten 3 Nächte
  {
    const parts = [], drivers = [];
    const bs = baseline(days, i, "sleep"), bq = baseline(days, i, "sleepScore");
    if (T.sleep != null && bs) { const z = (T.sleep - bs.m) / bs.sd; parts.push({ w: 0.5, z }); drivers.push({ t: `Schlaf ${T.sleep.toFixed(1)} h (${sgn((T.sleep - bs.m) * 60)} min vs. Ø)`, z }); }
    if (T.sleepScore != null && bq) { const z = (T.sleepScore - bq.m) / bq.sd; parts.push({ w: 0.3, z }); drivers.push({ t: `Sleep Score ${Math.round(T.sleepScore)} (${sgn(T.sleepScore - bq.m)} vs. Ø)`, z }); }
    if (bs) {
      const debt = days.slice(Math.max(0, i - 2), i + 1).reduce((s, d) => s + (d.sleep != null ? Math.max(0, bs.m - d.sleep) : 0), 0);
      if (debt > 0.3) { const z = -debt / 1.5; parts.push({ w: 0.2, z }); drivers.push({ t: `Schlafschuld 3 Nächte: ${debt.toFixed(1)} h`, z }); }
      else parts.push({ w: 0.2, z: 0.3 });
    }
    out.sleep = { value: combine(parts), drivers, signals: parts.length ? 1 : 0 };
  }

  // Stress & Energie: Garmin-Stress, Body Battery, Check-in-Stress, Alkohol am Vorabend
  {
    const parts = [], drivers = [];
    const bst = baseline(days, i, "stress"), bbb = baseline(days, i, "bbHigh");
    if (T.stress != null && bst) { const z = -(T.stress - bst.m) / bst.sd; parts.push({ w: 0.3, z }); drivers.push({ t: `Stress-Level ${Math.round(T.stress)} (${sgn(T.stress - bst.m)} vs. Ø)`, z }); }
    if (T.bbHigh != null && bbb) { const z = (T.bbHigh - bbb.m) / bbb.sd; parts.push({ w: 0.25, z }); drivers.push({ t: `Body Battery ${Math.round(T.bbHigh)} (${sgn(T.bbHigh - bbb.m)} vs. Ø)`, z }); }
    if (c?.stress) { const z = 3 - c.stress; parts.push({ w: 0.3, z }); drivers.push({ t: `Gefühlter Stress ${c.stress}/5`, z }); }
    if (c?.motivation) { const z = c.motivation - 3; parts.push({ w: 0.15, z }); drivers.push({ t: `Motivation ${c.motivation}/5`, z }); }
    const alc = (T.night || []).filter((t) => t.t === "alkohol").reduce((s, t) => s + (t.n || 1), 0);
    if (alc) { const z = -Math.min(2.5, 0.6 * alc); parts.push({ w: 0.3, z }); drivers.push({ t: `Alkohol am Vorabend (${alc} Gl.)`, z }); }
    out.stress = { value: combine(parts), drivers, signals: parts.length };
  }

  // Datenqualität: 5 Signale
  const recent = days.slice(Math.max(0, i - 3), i + 1);
  const sess = recent.reduce((s, d) => s + (d.sessions || 0), 0), rated = recent.reduce((s, d) => s + (d.rated || 0), 0);
  const sig = [
    ["HRV", T.hrv != null], ["Ruhepuls", T.rhr != null], ["Schlaf", T.sleep != null], ["Check-in", Boolean(c)],
    ["Gefühl nach Einheiten", sess === 0 || rated / sess >= 0.5],
  ];
  const have = sig.filter((x) => x[1]).length;
  const quality = { have, of: sig.length, missing: sig.filter((x) => !x[1]).map((x) => x[0]), level: have >= 4 ? "hoch" : have === 3 ? "mittel" : "niedrig" };

  // Limiter = schwächster Zustand (wenn unter 50; 55 entspricht dem persönlichen Normalzustand), Haupttreiber = stärkster positiver Faktor
  const list = Object.entries(out).filter(([, s]) => s.value != null).sort((a, b) => a[1].value - b[1].value);
  const lim = list[0] && list[0][1].value < 50 ? list[0] : null;
  const limiter = lim ? { key: lim[0], name: lim[0] === "muscle" && lim[1].limiter ? REGIONS[lim[1].limiter] : STATE_NAMES[lim[0]], value: lim[1].value, why: [...lim[1].drivers].filter((d) => lim[0] !== "muscle" || d.r === lim[1].limiter).sort((a, b) => a.z - b.z)[0]?.t.replace(/^(Beine|Oberkörper|Rumpf): /, "") || null } : null;
  const pos = Object.values(out).flatMap((s) => s.drivers).filter((d) => d.z > 0.4).sort((a, b) => b.z - a.z);
  return { states: out, quality, limiter, drivers: pos.slice(0, 2).map((d) => d.t) };
}

// Persönliche Einordnung: Abweichung zur 28-Tage-Baseline und Perzentil der letzten 12 Monate
export const CONTEXT_METRICS = [
  ["hrv", "HRV", " ms", 1, 0], ["rhr", "Ruhepuls", " bpm", -1, 0], ["sleep", "Schlaf", " h", 1, 1], ["sleepScore", "Sleep Score", "", 1, 0],
  ["bbHigh", "Body Battery", "", 1, 0], ["stress", "Stress", "", -1, 0], ["resp", "Atmung", " /min", 0, 1], ["vo2max", "VO2max", "", 1, 1],
];
export function personalContext(days, i = days.length - 1) {
  const T = days[i];
  if (!T) return [];
  const year = days.slice(Math.max(0, i - 365), i);
  return CONTEXT_METRICS.map(([k, label, unit, dir, dec]) => {
    const v = T[k];
    if (v == null) return null;
    const b = baseline(days, i, k);
    // Perzentil mit Mittelrang: gleiche Werte (auf Anzeigegenauigkeit gerundet) zählen zur Hälfte
    const rd = (x) => Number(x.toFixed(dec)), rv = rd(v);
    const hist = year.map((d) => d[k]).filter((x) => x != null).map(rd);
    const worse = hist.filter((x) => (dir >= 0 ? x < rv : x > rv)).length, same = hist.filter((x) => x === rv).length;
    const pct = hist.length >= 30 ? Math.round(((worse + same / 2) / hist.length) * 100) : null;
    const delta = b ? ((v - b.m) / b.m) * 100 : null;
    const good = dir === 0 || delta == null ? null : dir * delta > 2 ? true : dir * delta < -2 ? false : null;
    return { k, label, unit, value: Number(v.toFixed(dec)), delta, pct, good, base: b ? Number(b.m.toFixed(dec)) : null };
  }).filter(Boolean);
}

// Farbe eines Zustands (55 = normal)
export const stateColor = (v) => (v == null ? "none" : v >= 60 ? "good" : v >= 40 ? "warn" : "crit");
