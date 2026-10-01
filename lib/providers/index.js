import { strava } from "./strava";
import { whoop } from "./whoop";

// Garmin: Health/Activity API nur nach Freigabe im Garmin Connect Developer Program.
const garmin = {
  id: "garmin",
  name: "Garmin Connect",
  kind: "Body Battery, HRV, Schlaf, Workouts (Fenix, CIRQA, Edge …)",
  configured: () => Boolean(process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET),
  pendingApproval: true,
  setup: "Garmin gibt die Health API nur nach Bewerbung frei (developer.garmin.com/gc-developer-program). Bis dahin kommen Garmin-Workouts automatisch über Strava.",
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

export const PROVIDERS = { strava, whoop, garmin, oura, withings };
export const OAUTH = { strava, whoop };
