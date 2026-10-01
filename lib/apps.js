// App-Schlüssel der Schnittstellen (Strava, WHOOP …): im Admin-Bereich gepflegt, verschlüsselt gespeichert.
// Umgebungsvariablen gelten weiterhin als Vorgabe.
import { getSettings } from "./repo";
import { decrypt } from "./crypto";

export async function appCreds(provider) {
  const s = await getSettings();
  const a = s.apps?.[provider] || {};
  const env = {
    strava: { clientId: process.env.STRAVA_CLIENT_ID, clientSecret: process.env.STRAVA_CLIENT_SECRET },
    whoop: { clientId: process.env.WHOOP_CLIENT_ID, clientSecret: process.env.WHOOP_CLIENT_SECRET },
  }[provider] || {};
  let secret = env.clientSecret;
  if (a.clientSecret) { try { secret = decrypt(a.clientSecret); } catch {} }
  return { clientId: a.clientId || env.clientId || "", clientSecret: secret || "", verifyToken: a.verifyToken || process.env.STRAVA_VERIFY_TOKEN || "" };
}
export async function appConfigured(provider) {
  const c = await appCreds(provider);
  return Boolean(c.clientId && c.clientSecret);
}
