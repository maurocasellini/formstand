import { strava } from "./strava";
import { whoop } from "./whoop";
import { intervals } from "./intervals";

// Garmin: Health/Activity API nur nach Freigabe im Garmin Connect Developer Program.
const garmin = {
  id: "garmin",
  name: "Garmin Connect",
  kind: "Body Battery, HRV, Schlaf, Workouts (Fenix, CIRQA, Edge …)",
  configured: () => Boolean(process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET),
  pendingApproval: true,
  setup: "Direkte Garmin-API nur für Firmen und derzeit geschlossen. Automatisch über intervals.icu verbinden, alles Historische über den Garmin-Datenexport (unten) einlesen.",
};

const oura = {
  id: "oura", name: "Oura", kind: "Readiness, HRV, Schlaf",
  configured: () => false, soon: true,
  setup: "Folgt als nächste Schnittstelle (OAuth, frei verfügbar).",
};
const withings = {
  id: "withings", name: "Withings", kind: "Gewicht, Körperfett",
  configured: () => false, soon: true,
  setup: "Folgt (OAuth, frei verfügbar).",
};

export const PROVIDERS = { intervals, garmin, whoop, strava, oura, withings };
export const OAUTH = { strava, whoop };
export const SYNCABLE = { strava, whoop, intervals };
