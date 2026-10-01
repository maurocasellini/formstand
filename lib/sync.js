import { encrypt, decrypt } from "./crypto";
import { SYNCABLE } from "./providers";
import { estimateLoad } from "./load";
import { appCreds } from "./apps";
import * as repo from "./repo";

export const DAILY_COLS = ["recovery_score", "hrv", "rhr", "sleep_h", "strain", "steps", "sleep_score", "deep_h", "light_h", "rem_h", "awake_h", "avg_sleep_hr", "bb_high", "bb_low", "stress_avg", "spo2", "respiration", "readiness", "vo2max", "skin_temp", "intensity_min", "weight"];

export async function athleteZones(userId, manual) {
  const tests = (manual || (await repo.getManual(userId))).filter((e) => e.kind === "test").sort((a, b) => (a.day < b.day ? 1 : -1));
  const z = {};
  for (const t of tests) {
    const k = t.data?.test, v = Number(t.value);
    if (["ramp", "twenty", "zftp"].includes(k) && !z.ftp) z.ftp = v;
    if (["garmin_lt", "labor"].includes(k) && !z.lthr) z.lthr = v;
    if (k === "css" && !z.css) z.css = v;
  }
  return z;
}

async function accessToken(conn) {
  const p = SYNCABLE[conn.provider];
  if (p.apiKey) return decrypt(conn.access_token);
  if (conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 120000) return decrypt(conn.access_token);
  const t = await p.refresh(decrypt(conn.refresh_token), await appCreds(conn.provider));
  await repo.saveConnection(conn.user_id, conn.provider, {
    access_token: encrypt(t.access_token), ...(t.refresh_token ? { refresh_token: encrypt(t.refresh_token) } : {}), expires_at: new Date(t.expires_at).toISOString(),
  });
  return t.access_token;
}

export async function storeBatch(userId, provider, { raw = [], activities = [], daily = [] }) {
  if (raw.length) await repo.storeRaw(userId, provider, raw);
  if (activities.length) {
    const zones = await athleteZones(userId);
    await repo.upsertActivities(userId, activities.map((a) => ({
      ...a, start_time: new Date(a.start_time).toISOString(),
      load: a.load != null && a.load > 0 ? Math.round(a.load) : estimateLoad(a, zones),
    })));
  }
  if (daily.length) {
    await repo.upsertDaily(userId, daily.map((d) => {
      const o = { provider: d.provider, day: d.day };
      for (const c of DAILY_COLS) if (d[c] != null) o[c] = Number(d[c]);
      return o;
    }));
  }
  return raw.length + activities.length + daily.length;
}

export async function syncConnection(conn, { full = false } = {}) {
  const p = SYNCABLE[conn.provider];
  if (!p) return { ok: false, items: 0, message: "Unbekannte Quelle" };
  const since = full || !conn.last_sync_at ? new Date(Date.now() - 365 * 864e5) : new Date(new Date(conn.last_sync_at).getTime() - 3 * 864e5);
  try {
    const token = await accessToken(conn);
    const batch = await p.fetchSince(token, since, conn);
    const items = await storeBatch(conn.user_id, conn.provider, batch);
    await repo.saveConnection(conn.user_id, conn.provider, { last_sync_at: new Date().toISOString(), last_error: null, status: "active" });
    await repo.addRun({ user_id: conn.user_id, provider: conn.provider, ok: true, items, message: full ? "voll" : "inkrementell" });
    return { ok: true, items };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 300);
    await repo.saveConnection(conn.user_id, conn.provider, { last_error: msg });
    await repo.addRun({ user_id: conn.user_id, provider: conn.provider, ok: false, items: 0, message: msg });
    return { ok: false, items: 0, message: msg };
  }
}

export async function syncUser(userId, opts) {
  const conns = (await repo.getConnections(userId)).filter((c) => SYNCABLE[c.provider]);
  const out = [];
  for (const c of conns) out.push({ provider: c.provider, ...(await syncConnection({ ...c, user_id: userId }, opts)) });
  return out;
}

export async function syncAll() {
  let ok = 0, fail = 0;
  for (const c of await repo.allConnections()) {
    if (!SYNCABLE[c.provider]) continue;
    const r = await syncConnection(c); r.ok ? ok++ : fail++;
  }
  return { ok, fail };
}
