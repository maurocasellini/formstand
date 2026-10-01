import { strava } from "./strava";
import { whoop } from "./whoop";
import { intervals } from "./intervals";

// Garmin: direkte API nur für Firmen; läuft über intervals.icu und den Garmin-Datenexport.
const garmin = {
  id: "garmin",
  name: "Garmin Connect",
  kind: "Body Battery, HRV, Schlaf, Workouts (Fenix, CIRQA, Edge …)",
  via: "intervals",
  setup: "Direkte Garmin-API nur für Firmen und derzeit geschlossen. Automatisch über intervals.icu verbinden, alles Historische über den Garmin-Datenexport (unten) einlesen.",
};

const oura = {
  id: "oura", name: "Oura", kind: "Readiness, HRV, Schlaf",
  soon: true,
  setup: "Folgt als nächste Schnittstelle.",
};
const withings = {
  id: "withings", name: "Withings", kind: "Gewicht, Körperfett",
  soon: true,
  setup: "Folgt.",
};

export const PROVIDERS = { intervals, garmin, whoop, strava, oura, withings };
export const OAUTH = { strava, whoop };
export const SYNCABLE = { strava, whoop, intervals };
