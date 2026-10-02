// Einordnung absoluter Werte gegen Richtwerte (Alter/Geschlecht, wo es zählt): Stufe 0–4, Klartext, Skala.
// Stufe 4 = herausragend, 3 = sehr gut, 2 = gut/normal, 1 = mässig, 0 = auffällig. Richtwerte, keine Diagnose.
import { vo2Class, fitnessAge, vo2Score } from "./vo2";

const SCALES = {
  rhr: ["erhöht", "durchschnittlich", "gut", "sehr gut", "Athletenniveau"],
  hrv: ["tief", "eher tief", "üblich", "hoch", "sehr hoch"],
  sleep: ["zu kurz", "knapp", "gut", "sehr gut", "lang"],
  score: ["erholen", "gedämpft", "moderat", "gut", "top"],
  vo2max: ["schwach", "mässig", "gut", "ausgezeichnet", "überragend"],
  ctl: ["Einstieg", "Freizeit", "regelmässig", "ambitioniert", "Leistungssport"],
  weight: ["Untergewicht", "Normalgewicht", "leicht erhöht", "erhöht", "deutlich erhöht"],
};
// Position 0–1 auf der Skala aus Schwellen (aufsteigend) und Richtung
function posOf(v, th, higherBetter = true) {
  const k = th.filter((t) => v >= t).length; // 0..th.length
  const lo = k === 0 ? th[0] - (th[1] - th[0]) : th[k - 1], hi = k === th.length ? th[th.length - 1] + (th[1] - th[0]) : th[k];
  const frac = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  const p = (k + frac) / (th.length + 1);
  return higherBetter ? p : 1 - p;
}

export function rate(metric, v, { age = null, sex = "m", heightCm = null } = {}) {
  if (v == null || !Number.isFinite(v)) return null;
  const a = age || 40, w = sex === "w";
  const noAge = !age;
  switch (metric) {
    case "rhr": {
      const th = (w ? [52, 58, 66, 75] : [50, 56, 63, 72]); // Grenzen athlet|sehr gut|gut|durchschn.|erhöht
      const lvl = v < th[0] ? 4 : v < th[1] ? 3 : v < th[2] ? 2 : v < th[3] ? 1 : 0;
      const text = lvl === 4 ? `${Math.round(v)} bpm – so tief ist der Ruhepuls nur bei gut trainierten Ausdauersportlern. Dein Herz pumpt pro Schlag sehr viel Blut.`
        : lvl === 3 ? `${Math.round(v)} bpm – deutlich besser als der Durchschnitt (ca. 60–75). Zeichen guter Grundlagenausdauer.`
        : lvl === 2 ? `${Math.round(v)} bpm – gut, im gesunden Bereich.` : lvl === 1 ? `${Math.round(v)} bpm – durchschnittlich; mit regelmässigem Grundlagentraining sinkt er meist.` : `${Math.round(v)} bpm – erhöht. Bei anhaltend hohen Werten ärztlich abklären.`;
      return { lvl, label: SCALES.rhr[lvl], text, scale: SCALES.rhr, pos: posOf(v, th, false) };
    }
    case "hrv": {
      // grobe Richtwerte nächtliche HRV (rMSSD) nach Alter: [tief, eher tief, hoch, sehr hoch]
      const base = a < 30 ? [40, 55, 95, 120] : a < 40 ? [33, 45, 80, 105] : a < 50 ? [27, 37, 66, 88] : a < 60 ? [22, 30, 54, 72] : [18, 25, 45, 60];
      const lvl = v < base[0] ? 0 : v < base[1] ? 1 : v < base[2] ? 2 : v < base[3] ? 3 : 4;
      const text = lvl >= 3 ? `${Math.round(v)} ms – hoch für ${noAge ? "dein Alter" : `${a} Jahre`}: ein gut reguliertes Nervensystem und viel Erholungsreserve.`
        : lvl === 2 ? `${Math.round(v)} ms – im üblichen Bereich für ${noAge ? "dein Alter" : `${a} Jahre`}. HRV ist sehr individuell; wichtiger ist dein eigener Trend.`
        : `${Math.round(v)} ms – eher tief für ${noAge ? "dein Alter" : `${a} Jahre`}. Schlaf, Stress und Alkohol sind die grössten Hebel.`;
      return { lvl, label: SCALES.hrv[lvl], text, scale: SCALES.hrv, pos: posOf(v, base, true), approx: true };
    }
    case "sleep": {
      const th = [6, 7, 7.5, 9];
      const lvl = v < 6 ? 0 : v < 7 ? 1 : v < 7.5 ? 2 : v <= 9 ? 3 : 4;
      const text = lvl <= 1 ? `${v.toFixed(1)} h – weniger als die empfohlenen 7–9 h. Für Sportler ist Schlaf der wichtigste Erholungshebel.` : lvl <= 3 ? `${v.toFixed(1)} h – im empfohlenen Bereich (7–9 h).` : `${v.toFixed(1)} h – lang; gut nach harten Blöcken, sonst auf die Qualität achten.`;
      return { lvl: lvl === 4 ? 2 : lvl, label: SCALES.sleep[lvl], text, scale: SCALES.sleep, zones: ["z0", "z1", "z3", "z4", "z2"], pos: Math.min(0.98, Math.max(0.02, (v - 5) / 5)) };
    }
    case "score": {
      const lvl = v >= 80 ? 4 : v >= 67 ? 3 : v >= 45 ? 2 : v >= 34 ? 1 : 0;
      return { lvl, label: SCALES.score[lvl], text: `Ø ${Math.round(v)} von 100 – ${lvl >= 3 ? "du bist meist gut erholt und belastbar." : lvl === 2 ? "solide, mit Luft nach oben." : "oft gedämpft – Erholung priorisieren."}`, scale: SCALES.score, pos: v / 100 };
    }
    case "vo2max": {
      if (!age) return { lvl: v >= 52 ? 4 : v >= 46 ? 3 : v >= 40 ? 2 : v >= 34 ? 1 : 0, label: null, text: `${v.toFixed(1)} ml/kg/min. Für die Einordnung nach Alter unter Konto den Jahrgang eintragen.`, scale: SCALES.vo2max, pos: Math.min(1, Math.max(0, (v - 25) / 40)) };
      const c = vo2Class(v, a, sex), fa = fitnessAge(v, sex);
      const text = c.k === 4 ? `${v.toFixed(1)} – überragend für ${w ? "Frauen" : "Männer"} mit ${a} Jahren: Niveau ambitionierter Ausdauersportler. Fitnessalter ${fa <= 20 ? "unter 20" : `etwa ${fa}`} Jahre.`
        : c.k === 3 ? `${v.toFixed(1)} – ausgezeichnet für ${a} Jahre. Fitnessalter etwa ${fa} Jahre.` : `${v.toFixed(1)} – ${c.name} für ${a} Jahre${c.next ? `; «${c.next.name}» ab ${c.next.at}` : ""}. Fitnessalter etwa ${fa} Jahre.`;
      return { lvl: c.k, label: c.name, text, scale: SCALES.vo2max, pos: Math.min(0.98, vo2Score(v, a, sex) / 5) };
    }
    case "ctl": {
      const th = [15, 35, 60, 90];
      const lvl = v < th[0] ? 0 : v < th[1] ? 1 : v < th[2] ? 2 : v < th[3] ? 3 : 4;
      const text = [`Fitness ${Math.round(v)} – Einstiegsniveau.`, `Fitness ${Math.round(v)} – Freizeitniveau, Luft nach oben.`, `Fitness ${Math.round(v)} – regelmässig trainiert.`, `Fitness ${Math.round(v)} – ambitioniertes Trainingsniveau.`, `Fitness ${Math.round(v)} – Umfang wie im Leistungssport.`][lvl];
      return { lvl, label: SCALES.ctl[lvl], text, scale: SCALES.ctl, pos: posOf(v, th, true) };
    }
    case "weight": {
      if (!heightCm) return null;
      const bmi = v / (heightCm / 100) ** 2, th = [18.5, 25, 27.5, 30];
      const k = bmi < th[0] ? 0 : bmi < th[1] ? 1 : bmi < th[2] ? 2 : bmi < th[3] ? 3 : 4;
      const lvl = [1, 3, 2, 1, 0][k];
      return { lvl, label: SCALES.weight[k], text: `BMI ${bmi.toFixed(1)} (${SCALES.weight[k]}). Bei viel Muskelmasse überschätzt der BMI – InBody ist genauer.`, scale: SCALES.weight, zones: ["z1", "z4", "z2", "z1", "z0"], pos: Math.min(0.98, Math.max(0.02, (bmi - 16) / 18)) };
    }
    default: return null;
  }
}
