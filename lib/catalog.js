// Tests: group = Bereich auf der Test-Seite, fmt = Eingabe/Anzeige, norms = Schwellen für die Stufen 1–5
// (Einsteiger → Elite) getrennt nach m/w; better −1 = kleiner ist besser (Zeiten). area = Schwäche, auf die der Test einzahlt.
// Kraft: Gewicht × 1–5 Wiederholungen → geschätztes 1RM (Brzycki), Normen in × Körpergewicht.
export const TEST_GROUPS = {
  diagnostik: ["Ausdauer-Diagnostik", "FTP, Schwelle, VO2max, CSS – daraus rechnet Formstand deine Zonen."],
  kraft: ["Maximalkraft", "1–5 Wiederholungen sauber ans Limit – kein 1RM nötig. Formstand schätzt daraus das 1RM."],
  lauf: ["Lauf & Rudern", "Zeit über eine feste Strecke – Formstand rechnet die Pace pro km bzw. 500 m."],
  fitness: ["Grundlagenfitness", "Wiederholungen in fester Zeit, Halten, Springen – ohne Geräte."],
};
export const TEST_TYPES = {
  ramp: { name: "Zwift Ramp Test", group: "diagnostik", fmt: "num", conf: "mittel", unit: "W", label: "FTP (W)", ftp: true, wks: 8, desc: "+20 W pro Minute bis nichts mehr geht. FTP = 75 % der besten Minute." },
  twenty: { name: "Zwift 20-min-Test", group: "diagnostik", fmt: "num", conf: "hoch", unit: "W", label: "FTP (W)", ftp: true, wks: 8, desc: "20 min Vollgas, FTP = 95 % des Schnitts. Genauer für Ausdauertypen." },
  zftp: { name: "zFTP (Zwift-Schätzung)", group: "diagnostik", fmt: "num", conf: "niedrig", unit: "W", label: "FTP (W)", ftp: true, wks: 4, desc: "Zwift schätzt die FTP laufend aus normalen Fahrten." },
  garmin_lt: { name: "Garmin Laktatschwelle", group: "diagnostik", fmt: "num", conf: "mittel", unit: "bpm", label: "Schwellenpuls (bpm)", hr: true, wks: 8, desc: "Geführter Lauftest auf der Uhr mit Brustgurt. Aus dem Puls geschätzt." },
  labor: { name: "Labor-Stufentest (Laktat)", group: "diagnostik", fmt: "num", conf: "hoch", unit: "bpm", label: "Puls an LT2 (bpm)", hr: true, wks: 16, desc: "Echte Blutlaktat-Messung. Genaueste Basis für Zonen." },
  vo2: { name: "VO2max (Schätzung)", group: "diagnostik", fmt: "num", conf: "niedrig", unit: "ml/kg/min", label: "VO2max", wks: 4, desc: "Schätzung der Uhr. Gut als Trend." },
  css: { name: "CSS-Test Schwimmen", group: "diagnostik", fmt: "num", conf: "hoch", unit: "s/100 m", label: "CSS in Sekunden pro 100 m (z. B. 105 = 1:45)", css: true, wks: 8, desc: "400 m und 200 m Vollgas. CSS = 200 / (Zeit400 − Zeit200) – deine Schwellenpace im Wasser." },

  // ---------- Maximalkraft ----------
  kreuzheben: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Kreuzheben", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_beine", norms: { m: [1, 1.5, 2, 2.5, 3], w: [0.75, 1, 1.25, 1.75, 2.25] }, desc: "Konventionell oder Sumo, Hantel aus dem Stand am Boden. Rücken neutral, kein Abprallen." },
  kniebeuge: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Kniebeuge (Back Squat)", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_beine", norms: { m: [0.75, 1.25, 1.5, 2, 2.5], w: [0.5, 0.75, 1, 1.5, 1.75] }, desc: "Hantel auf dem oberen Rücken, Hüftfalte mindestens auf Kniehöhe." },
  frontkniebeuge: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Frontkniebeuge", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_beine", norms: { m: [0.6, 1, 1.25, 1.6, 2], w: [0.4, 0.6, 0.85, 1.2, 1.5] }, desc: "Hantel vorne auf den Schultern, aufrechter Oberkörper, volle Tiefe." },
  bankdruecken: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Bankdrücken", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_ober", norms: { m: [0.5, 0.75, 1, 1.5, 2], w: [0.25, 0.5, 0.75, 1, 1.5] }, desc: "Hantel bis zur Brust, kurz ablegen, ohne Abprallen hochdrücken." },
  schulterdruecken: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Schulterdrücken (strikt)", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_ober", norms: { m: [0.4, 0.55, 0.75, 1, 1.25], w: [0.2, 0.35, 0.5, 0.65, 0.85] }, desc: "Stehend, ohne Schwung aus den Beinen über Kopf drücken." },
  push_press: { group: "kraft", fmt: "lift", conf: "hoch", unit: "kg", name: "Push Press", label: "Gewicht kg × Wdh.", wks: 10, area: "kraft_ober", norms: { m: [0.5, 0.7, 0.9, 1.15, 1.4], w: [0.3, 0.45, 0.6, 0.8, 1] }, desc: "Kurzer Dip aus den Beinen, dann explosiv über Kopf. Kein zweiter Dip (sonst Push Jerk)." },
  // ---------- Lauf & Rudern (Zeit in Sekunden; Norwegian 4×4 als Ø-Pace pro km) ----------
  run_400: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 400, per: 1000, name: "400 m Lauf", label: "Zeit (m:ss)", wks: 8, area: "sprint", norms: { m: [95, 80, 70, 62, 55], w: [110, 95, 82, 72, 64] }, desc: "Eine Bahnrunde Vollgas nach gutem Einlaufen." },
  run_800: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 800, per: 1000, name: "800 m Lauf", label: "Zeit (m:ss)", wks: 8, area: "vo2", norms: { m: [210, 180, 160, 145, 130], w: [245, 210, 185, 165, 150] }, desc: "Zwei Runden, gleichmässig hart – die zweite Runde entscheidet." },
  run_1k: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 1000, per: 1000, name: "1 km Lauf", label: "Zeit (m:ss)", wks: 8, area: "vo2", norms: { m: [270, 235, 210, 190, 170], w: [315, 270, 240, 215, 195] }, desc: "1 km Vollgas auf flacher Strecke oder Bahn." },
  run_5k: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 5000, per: 1000, name: "5 km Lauf", label: "Zeit (m:ss)", wks: 10, area: "lauftempo", norms: { m: [1800, 1560, 1380, 1230, 1080], w: [2100, 1800, 1590, 1410, 1230] }, desc: "5 km so schnell wie möglich, gleichmässig eingeteilt. Auch ein Parkrun zählt." },
  cooper: { group: "lauf", fmt: "num", conf: "mittel", unit: "m", better: 1, name: "Cooper-Test (12 min)", label: "Strecke in Metern", wks: 8, area: "grundlage", norms: { m: [2000, 2400, 2700, 3000, 3200], w: [1700, 2100, 2400, 2700, 2900] }, desc: "12 Minuten so weit wie möglich laufen, Strecke messen." },
  norwegian: { group: "lauf", fmt: "pace", conf: "mittel", unit: "s/km", per: 1000, name: "Norwegian 4×4", label: "Ø-Pace der 4 Intervalle (m:ss pro km)", wks: 6, area: "vo2", norms: { m: [360, 315, 280, 250, 225], w: [400, 350, 315, 280, 255] }, desc: "4× 4 min bei 85–95 % HFmax, 3 min locker dazwischen. Ø-Pace der vier harten Intervalle eintragen, Puls in die Notiz." },
  row_500: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 500, per: 500, name: "500 m Rudern", label: "Zeit (m:ss)", wks: 8, area: "sprint", norms: { m: [130, 115, 105, 97, 90], w: [150, 132, 120, 110, 102] }, desc: "Concept2-Ergometer, Widerstand 5–7, Vollgas." },
  row_2k: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 2000, per: 500, name: "2000 m Rudern", label: "Zeit (m:ss)", wks: 10, area: "vo2", norms: { m: [570, 500, 460, 430, 400], w: [660, 580, 530, 495, 460] }, desc: "Der Klassiker auf dem Concept2 – gleichmässig, die letzten 500 m alles." },
  ski_1k: { group: "lauf", fmt: "time", conf: "hoch", unit: "s", dist: 1000, per: 500, name: "1000 m SkiErg", label: "Zeit (m:ss)", wks: 8, area: "hyrox_stationen", norms: { m: [300, 270, 245, 225, 210], w: [345, 305, 280, 255, 240] }, desc: "Wie die HYROX-Station: 1000 m auf dem SkiErg." },
  // ---------- Grundlagenfitness ----------
  burpees: { group: "fitness", fmt: "reps", dur: true, conf: "mittel", unit: "Wdh.", better: 1, name: "Burpees auf Zeit", label: "Wiederholungen", wks: 6, area: "kraftausdauer", norms: { m: [10, 15, 20, 25, 30], w: [8, 12, 17, 21, 26] }, desc: "Brust zum Boden, aufstehen, Sprung mit Klatschen über dem Kopf. Dauer frei wählbar (1, 3, 5, 7 oder 10 min)." },
  wallballs: { group: "fitness", fmt: "reps", dur: true, conf: "mittel", unit: "Wdh.", better: 1, name: "Wall Balls auf Zeit", label: "Wiederholungen", wks: 6, area: "hyrox_stationen", norms: { m: [12, 17, 22, 26, 30], w: [10, 15, 19, 23, 27] }, desc: "6 kg (Frauen 4 kg) auf 3 m (2,7 m), volle Kniebeuge. Dauer frei wählbar." },
  liegestuetz: { group: "fitness", fmt: "reps", conf: "mittel", unit: "Wdh.", better: 1, name: "Liegestütz max.", label: "Wiederholungen am Stück", wks: 6, area: "kraft_ober", norms: { m: [10, 20, 30, 40, 55], w: [3, 8, 15, 22, 32] }, desc: "Brust bis eine Faust über dem Boden, Körper gerade, ohne Pause am Stück." },
  klimmzug: { group: "fitness", fmt: "reps", conf: "mittel", unit: "Wdh.", better: 1, name: "Klimmzüge max.", label: "Wiederholungen am Stück", wks: 6, area: "kraft_ober", norms: { m: [1, 4, 8, 13, 18], w: [0.5, 1, 3, 6, 10] }, desc: "Aus dem Hang, Kinn über die Stange, ohne Schwung." },
  plank: { group: "fitness", fmt: "time", conf: "mittel", unit: "s", better: 1, name: "Unterarmstütz (Plank)", label: "Haltezeit (m:ss)", wks: 6, area: "rumpf", norms: { m: [30, 60, 90, 150, 240], w: [30, 60, 90, 150, 240] }, desc: "Unterarme und Zehen, Körper gerade – halten, bis die Hüfte absinkt." },
  sprung: { group: "fitness", fmt: "num", conf: "mittel", unit: "cm", better: 1, name: "Standweitsprung", label: "Weite in cm", wks: 8, area: "sprint", norms: { m: [160, 190, 215, 240, 265], w: [125, 150, 175, 195, 215] }, desc: "Beidbeinig aus dem Stand, Landung stabil. Bester von 3 Versuchen." },
};
// Gültige Bereiche (Eingabe und KI-Auslesen)
export const TEST_RANGE = { ramp: [80, 600], twenty: [80, 600], zftp: [80, 600], garmin_lt: [100, 215], labor: [100, 215], vo2: [25, 95], css: [50, 240], kreuzheben: [10, 450], kniebeuge: [10, 400], frontkniebeuge: [10, 350], bankdruecken: [5, 350], schulterdruecken: [5, 200], push_press: [5, 250], run_400: [40, 240], run_800: [90, 480], run_1k: [120, 600], run_5k: [700, 3600], cooper: [800, 5000], norwegian: [150, 720], row_500: [70, 240], row_2k: [330, 900], ski_1k: [180, 600], burpees: [1, 400], wallballs: [1, 400], liegestuetz: [1, 150], klimmzug: [1, 60], plank: [5, 1200], sprung: [50, 380] };
export const TEST_DURATIONS = [1, 3, 5, 7, 10];
// Geschätztes 1RM aus 1–5 Wiederholungen (Brzycki)
export const e1rm = (kg, reps = 1) => (kg ? Math.round((kg * 36) / (37 - Math.min(10, Math.max(1, reps)))) : null);
export const mss = (s) => (s == null ? "–" : s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
// Ergebnis lesbar: «100 kg × 3 (≈ 106 kg 1RM)», «3:05 (3:51/km)», «62 Wdh. in 5 min»
export function testText(key, value, data = {}) {
  const t = TEST_TYPES[key]; if (!t) return `${value}`;
  const v = Number(value);
  if (t.fmt === "lift") return `${v} kg × ${data.reps || 1}${(data.reps || 1) > 1 ? ` (≈ ${e1rm(v, data.reps)} kg 1RM)` : ""}`;
  if (t.fmt === "time" && t.dist) return `${mss(v)} (${mss((v / t.dist) * t.per)}/${t.per === 500 ? "500 m" : "km"})`;
  if (t.fmt === "time") return mss(v);
  if (t.fmt === "pace") return `${mss(v)}/km`;
  if (t.dur) return `${v} Wdh. in ${data.dur || 1} min`;
  if (key === "css") return `${v} s (${mss(v)}/100 m)`;
  return `${v} ${t.unit}`;
}

// Bandbreite statt Scheingenauigkeit: ±pct, gerundet auf step
export const range = (v, pct = 0.05, step = 50) => (v == null ? null : [Math.round((v * (1 - pct)) / step) * step, Math.round((v * (1 + pct)) / step) * step]);
export const fmtRange = (r, unit = "") => (r ? `${r[0].toLocaleString("de-CH")}–${r[1].toLocaleString("de-CH")}${unit}` : "–");

export const TRIGGERS = [
  ["alkohol", "Alkohol"], ["spaet", "Spätes Essen"], ["reise", "Reise"], ["krank", "Krank"],
  ["stress", "Stress"], ["koffein", "Koffein nach 14 Uhr"], ["screen", "Bildschirm spät"], ["sauna", "Sauna spät"],
  ["fastfood", "Fast Food / viel Zucker"], ["nap", "Mittagsschlaf"], ["mobility", "Mobility / Dehnen"], ["meditation", "Meditation / Atemübung"],
  ["eisbad", "Kälte / Eisbad"], ["massage", "Massage"],
];
// Von Formstand selbst erkannt (nicht eintragen nötig)
export const DERIVED_TRIGGERS = { spaettraining: "Training spät abends", harttraining: "Harte Einheit am Tag davor" };
export const triggerName = (t) => (TRIGGERS.find((x) => x[0] === t) || [t, DERIVED_TRIGGERS[t] || t])[1];

export const MEDIA_KINDS = { body_photo: "Körperfoto", meal: "Mahlzeit", inbody: "InBody / Körperanalyse", test: "Leistungstest", blood: "Blutwerte", other: "Sonstiges" };

export const POWER_ZONES = [["Z1 Erholung", 0, 0.55], ["Z2 Grundlage", 0.56, 0.75], ["Z3 Tempo", 0.76, 0.9], ["Z4 Schwelle", 0.91, 1.05], ["Z5 VO2max", 1.06, 1.2], ["Z6 Anaerob", 1.21, 1.5], ["Z7 Sprint", 1.51, null]];
export const HR_ZONES = [["Z1", 0, 0.85], ["Z2", 0.85, 0.89], ["Z3", 0.9, 0.94], ["Z4", 0.95, 0.99], ["Z5a", 1.0, 1.02], ["Z5b", 1.03, 1.06], ["Z5c", 1.06, null]];
export const SPORTS = ["Rad & Laufen", "Triathlon", "Laufen", "Radfahren", "Kraft & Hyrox", "Ausdauer allgemein", "Teamsport"];

// ---------- Ziele, Wettkämpfe, Schwächen ----------
export const FOCUS = {
  performance: ["Leistung", "Schneller und stärker werden, Wettkämpfe gut bestreiten"],
  maintain: ["Form halten", "Fitness erhalten bei wenig Zeit"],
  cut: ["Abnehmen", "Körperfett reduzieren, Leistung möglichst halten"],
  muscle: ["Muskelaufbau", "Kraft und Muskelmasse aufbauen"],
  health: ["Gesundheit", "Fit, ausgeglichen, gut schlafen"],
};
// sport: bike | run | tri | hyrox | strength | other
export const EVENT_TYPES = {
  rad_marathon: ["Radmarathon / Granfondo", "bike"], rad_rennen: ["Radrennen / Zeitfahren", "bike"], gravel: ["Gravel / MTB", "bike"],
  lauf_10k: ["10 km Lauf", "run"], lauf_hm: ["Halbmarathon", "run"], lauf_m: ["Marathon", "run"], trail: ["Trail / Berglauf", "run"],
  tri_kurz: ["Triathlon Sprint/Olympisch", "tri"], tri_lang: ["Triathlon 70.3 / Langdistanz", "tri"],
  hyrox: ["HYROX", "hyrox"], hybrid: ["Hybrid-Rennen (ATHX, DEKA …)", "hyrox"], crossfit: ["CrossFit-Wettkampf", "strength"], sonst: ["Sonstiges", "other"],
};
export const WEAKNESSES = {
  grundlage: ["Grundlagenausdauer", "Lange gleichmässig fahren/laufen, wenig Einbruch"],
  schwelle: ["Schwelle / FTP", "Längere harte Abschnitte halten"],
  vo2: ["VO2max / Spitzenleistung", "3–8 min Vollgas, Attacken"],
  sprint: ["Sprint / Antritt", "Kurze explosive Spitzen"],
  klettern: ["Bergfahren / Klettern", "Lange Anstiege, niedrige Trittfrequenz"],
  lauftempo: ["Lauftempo / Laufökonomie", "Schneller laufen bei gleichem Puls"],
  langstrecke: ["Durchhalten / Verpflegung", "Letztes Drittel, Essen und Trinken unterwegs"],
  kraft_beine: ["Kraft Beine", "Kniebeuge, Kreuzheben, Sprungkraft"],
  kraft_ober: ["Kraft Oberkörper", "Drücken, Ziehen, Griffkraft"],
  rumpf: ["Rumpf / Stabilität", "Rücken, Bauch, Hüfte"],
  mobilitaet: ["Beweglichkeit", "Hüfte, Sprunggelenk, Brustwirbelsäule"],
  schwimmen: ["Schwimmen", "Technik, Wasserlage, Ausdauer im Wasser"],
  freiwasser: ["Freiwasser / Wechsel", "Neopren, Orientierung, Koppeln Rad–Lauf"],
  kraftausdauer: ["Kraftausdauer / Fitness", "Burpees, Liegestütz, Zirkel – viele Wiederholungen unter Ermüdung"],
  hyrox_stationen: ["HYROX-Stationen", "Sled, Wall Balls, Burpees, Laufen unter Ermüdung"],
  erholung: ["Erholung / Schlaf", "Zu wenig Regeneration, oft müde"],
  koerper: ["Körperkomposition", "Körperfett runter, Muskeln halten"],
};

// Schwimm-Zonen relativ zur CSS-Pace (Sekunden pro 100 m, + = langsamer)
export const SWIM_ZONES = [["Z1 Technik/locker", 15, null], ["Z2 Grundlage", 8, 15], ["Z3 Tempo", 3, 8], ["Z4 Schwelle (CSS)", -2, 3], ["Z5 schnell", null, -2]];
export const pace = (s) => (s == null ? "–" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
