import { categorize } from "../load";

const API = "https://www.strava.com/api/v3";

export const strava = {
  id: "strava",
  name: "Strava",
  kind: "Workouts",
  configured: () => Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
  setup: "Auf strava.com/settings/api eine App anlegen. Als Callback-Domain die Domain dieser App eintragen. Client ID und Secret als STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET in Vercel hinterlegen.",

  authUrl(state, redirectUri) {
    const p = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
      approval_prompt: "auto", scope: "read,activity:read_all", state,
    });
    return `https://www.strava.com/oauth/authorize?${p}`;
  },

  async exchange(code) {
    const r = await fetch("https://www.strava.com/oauth/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, code, grant_type: "authorization_code" }),
    });
    if (!r.ok) throw new Error(`Strava-Anmeldung fehlgeschlagen (${r.status})`);
    const j = await r.json();
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(j.expires_at * 1000), external_id: String(j.athlete?.id || ""), scope: "read,activity:read_all" };
  },

  async refresh(refreshToken) {
    const r = await fetch("https://www.strava.com/oauth/token", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!r.ok) throw new Error(`Strava-Token erneuern fehlgeschlagen (${r.status})`);
    const j = await r.json();
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(j.expires_at * 1000) };
  },

  // Liefert { raw: [{kind, external_id, payload}], activities: [...], daily: [] }
  async fetchSince(token, since) {
    const after = Math.floor(since.getTime() / 1000);
    const raw = [], activities = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { authorization: `Bearer ${token}` } });
      if (r.status === 429) throw new Error("Strava-Limit erreicht, später erneut");
      if (!r.ok) throw new Error(`Strava-Abruf fehlgeschlagen (${r.status})`);
      const list = await r.json();
      for (const a of list) { raw.push({ kind: "activity", external_id: String(a.id), payload: a }); activities.push(this.normalize(a)); }
      if (list.length < 100) break;
    }
    return { raw, activities, daily: [] };
  },

  async fetchOne(token, id) {
    const r = await fetch(`${API}/activities/${id}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Strava-Aktivität ${id} (${r.status})`);
    const a = await r.json();
    return { raw: [{ kind: "activity", external_id: String(a.id), payload: a }], activities: [this.normalize(a)], daily: [] };
  },

  normalize(a) {
    const sport = a.sport_type || a.type;
    const virtual = /virtual/i.test(sport) || /zwift/i.test(a.device_name || "");
    return {
      provider: "strava", external_id: String(a.id), start_time: a.start_date, day: String(a.start_date_local || a.start_date).slice(0, 10),
      sport, category: categorize(sport), name: a.name, duration_s: a.moving_time || a.elapsed_time || 0,
      distance_m: a.distance ?? null, avg_hr: a.average_heartrate ?? null, max_hr: a.max_heartrate ?? null,
      avg_power: a.average_watts ?? null, np_power: a.weighted_average_watts ?? null, kj: a.kilojoules ?? null,
      kcal: a.calories ?? (a.kilojoules ? Math.round(a.kilojoules) : null), has_power: Boolean(a.device_watts), virtual,
    };
  },
};
