export const TEST_TYPES = {
  ramp: { name: "Zwift Ramp Test", unit: "W", label: "FTP (W)", ftp: true, wks: 8, desc: "+20 W pro Minute bis nichts mehr geht. FTP = 75 % der besten Minute." },
  twenty: { name: "Zwift 20-min-Test", unit: "W", label: "FTP (W)", ftp: true, wks: 8, desc: "20 min Vollgas, FTP = 95 % des Schnitts. Genauer für Ausdauertypen." },
  zftp: { name: "zFTP (Zwift-Schätzung)", unit: "W", label: "FTP (W)", ftp: true, wks: 4, desc: "Zwift schätzt die FTP laufend aus normalen Fahrten." },
  garmin_lt: { name: "Garmin Laktatschwelle", unit: "bpm", label: "Schwellenpuls (bpm)", hr: true, wks: 8, desc: "Geführter Lauftest auf der Uhr mit Brustgurt. Aus dem Puls geschätzt." },
  labor: { name: "Labor-Stufentest (Laktat)", unit: "bpm", label: "Puls an LT2 (bpm)", hr: true, wks: 16, desc: "Echte Blutlaktat-Messung. Genaueste Basis für Zonen." },
  vo2: { name: "VO2max (Schätzung)", unit: "ml/kg/min", label: "VO2max", wks: 4, desc: "Schätzung der Uhr. Gut als Trend." },
};

export const TRIGGERS = [
  ["alkohol", "Alkohol"], ["spaet", "Spätes Essen"], ["reise", "Reise"], ["krank", "Krank"],
  ["stress", "Stress"], ["koffein", "Koffein nach 14 Uhr"], ["screen", "Bildschirm spät"], ["sauna", "Sauna spät"],
];
export const triggerName = (t) => (TRIGGERS.find((x) => x[0] === t) || [t, t])[1];

export const MEDIA_KINDS = { body_photo: "Körperfoto", meal: "Mahlzeit", inbody: "InBody / Körperanalyse", blood: "Blutwerte", other: "Sonstiges" };

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
  hyrox: ["HYROX", "hyrox"], crossfit: ["CrossFit-Wettkampf", "strength"], sonst: ["Sonstiges", "other"],
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
  hyrox_stationen: ["HYROX-Stationen", "Sled, Wall Balls, Burpees, Laufen unter Ermüdung"],
  erholung: ["Erholung / Schlaf", "Zu wenig Regeneration, oft müde"],
  koerper: ["Körperkomposition", "Körperfett runter, Muskeln halten"],
};
