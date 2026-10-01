import { categorize } from "../load";

const BASE = "https://api.prod.whoop.com";

async function pageAll(token, path, since) {
  const out = [];
  let next = null;
  for (let i = 0; i < 20; i++) {
    const p = new URLSearchParams({ start: since.toISOString(), limit: "25" });
    if (next) p.set("nextToken", next);
    const r = await fetch(`${BASE}${path}?${p}`, { headers: { authorization: `Bearer ${token}` } });
    if (r.status === 429) throw new Error("WHOOP-Limit erreicht, später erneut");
    if (!r.ok) throw new Error(`WHOOP ${path} (${r.status})`);
    const j = await r.json();
    out.push(...(j.records || []));
    next = j.next_token || j.nextToken;
    if (!next) break;
  }
  return out;
}
const day = (iso) => String(iso).slice(0, 10);

export const whoop = {
  id: "whoop",
  name: "WHOOP",
  kind: "Recovery, Schlaf, Strain, Workouts",
  oauth: true,
  setup: "Der Admin trägt einmal die WHOOP-App (Client ID und Secret) unter Admin → Schnittstellen ein. Danach verbindet jede Person ihr eigenes WHOOP-Konto mit einem Klick.",

  authUrl(state, redirectUri, c) {
    const p = new URLSearchParams({
      client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", state,
      scope: "offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement",
    });
    return `${BASE}/oauth/oauth2/auth?${p}`;
  },

  async token(body, c) {
    const r = await fetch(`${BASE}/oauth/oauth2/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }),
    });
    if (!r.ok) throw new Error(`WHOOP-Anmeldung fehlgeschlagen (${r.status})`);
    const j = await r.json();
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000), scope: j.scope };
  },
  async exchange(code, redirectUri, c) {
    const t = await this.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri }, c);
    try {
      const r = await fetch(`${BASE}/developer/v2/user/profile/basic`, { headers: { authorization: `Bearer ${t.access_token}` } });
      if (r.ok) t.external_id = String((await r.json()).user_id || "");
    } catch {}
    return t;
  },
  refresh(refreshToken, c) { return this.token({ grant_type: "refresh_token", refresh_token: refreshToken, scope: "offline" }, c); },

  async fetchSince(token, since) {
    const [rec, sleep, workouts, cycles] = await Promise.all([
      pageAll(token, "/developer/v2/recovery", since),
      pageAll(token, "/developer/v2/activity/sleep", since),
      pageAll(token, "/developer/v2/activity/workout", since),
      pageAll(token, "/developer/v2/cycle", since),
    ]);
    const raw = [
      ...rec.map((x) => ({ kind: "recovery", external_id: String(x.cycle_id ?? x.sleep_id), payload: x })),
      ...sleep.map((x) => ({ kind: "sleep", external_id: String(x.id), payload: x })),
      ...workouts.map((x) => ({ kind: "workout", external_id: String(x.id), payload: x })),
      ...cycles.map((x) => ({ kind: "cycle", external_id: String(x.id), payload: x })),
    ];
    const daily = new Map();
    const d = (k) => { if (!daily.has(k)) daily.set(k, { provider: "whoop", day: k }); return daily.get(k); };
    for (const r of rec) if (r.score) { const o = d(day(r.created_at)); o.recovery_score = r.score.recovery_score; o.hrv = r.score.hrv_rmssd_milli; o.rhr = r.score.resting_heart_rate; }
    for (const s of sleep) if (!s.nap && s.score?.stage_summary) {
      const st = s.score.stage_summary, h = ((st.total_in_bed_time_milli || 0) - (st.total_awake_time_milli || 0)) / 3.6e6;
      if (h > 0) { const o = d(day(s.end)); o.sleep_h = Math.round(h * 100) / 100; }
    }
    for (const c of cycles) if (c.score) d(day(c.start)).strain = c.score.strain;
    const activities = workouts.map((w) => {
      const sport = w.sport_name || "workout";
      return {
        provider: "whoop", external_id: String(w.id), start_time: w.start, day: day(w.start), sport, category: categorize(sport), name: sport,
        duration_s: Math.round((new Date(w.end) - new Date(w.start)) / 1000), avg_hr: w.score?.average_heart_rate ?? null, max_hr: w.score?.max_heart_rate ?? null,
        kj: w.score?.kilojoule ?? null, kcal: w.score?.kilojoule ? Math.round(w.score.kilojoule / 4.184) : null, has_power: false,
      };
    });
    return { raw, activities, daily: [...daily.values()] };
  },
};
