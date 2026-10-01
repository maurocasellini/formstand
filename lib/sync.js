import { q, one } from "./db";
import { encrypt, decrypt } from "./crypto";
import { SYNCABLE } from "./providers";
import { estimateLoad } from "./load";

export async function athleteZones(userId) {
  const rows = await q(
    `select distinct on (data->>'test') data->>'test' as test, value from manual_entries
      where user_id=$1 and kind='test' order by data->>'test', day desc`, [userId]);
  const z = {};
  for (const r of rows) {
    const t = r.test, v = Number(r.value);
    if (["ramp", "twenty", "zftp"].includes(t) && !z.ftp) z.ftp = v;
    if (["garmin_lt", "labor"].includes(t) && !z.lthr) z.lthr = v;
  }
  return z;
}

async function accessToken(conn) {
  const p = SYNCABLE[conn.provider];
  if (p.apiKey) return decrypt(conn.access_token);
  if (conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 120000) return decrypt(conn.access_token);
  const t = await p.refresh(decrypt(conn.refresh_token));
  await q("update connections set access_token=$1, refresh_token=coalesce($2, refresh_token), expires_at=$3 where id=$4",
    [encrypt(t.access_token), t.refresh_token ? encrypt(t.refresh_token) : null, t.expires_at, conn.id]);
  return t.access_token;
}

export const DAILY_COLS = ["recovery_score", "hrv", "rhr", "sleep_h", "strain", "steps", "sleep_score", "deep_h", "light_h", "rem_h", "awake_h", "avg_sleep_hr", "bb_high", "bb_low", "stress_avg", "spo2", "respiration", "readiness", "vo2max", "skin_temp", "intensity_min", "weight"];

export async function storeBatch(userId, provider, { raw = [], activities = [], daily = [] }) {
  if (raw.length) {
    await q(`insert into raw_events (user_id, provider, kind, external_id, payload)
             select $1, $2, x.kind, x.external_id, x.payload from jsonb_to_recordset($3::jsonb) as x(kind text, external_id text, payload jsonb)
             on conflict (user_id, provider, kind, external_id) do update set payload = excluded.payload, fetched_at = now()`,
      [userId, provider, JSON.stringify(raw)]);
  }
  if (activities.length) {
    const zones = await athleteZones(userId);
    const rows = activities.map((a) => ({ ...a, load: a.load != null && a.load > 0 ? Math.round(a.load) : estimateLoad(a, zones) }));
    await q(`insert into activities (user_id, provider, external_id, start_time, day, sport, category, name, duration_s, distance_m, avg_hr, max_hr, avg_power, np_power, kj, kcal, has_power, load)
             select $1, x.provider, x.external_id, x.start_time, x.day, x.sport, x.category, x.name, x.duration_s, x.distance_m, x.avg_hr, x.max_hr, x.avg_power, x.np_power, x.kj, x.kcal, coalesce(x.has_power,false), x.load
               from jsonb_to_recordset($2::jsonb) as x(provider text, external_id text, start_time timestamptz, day date, sport text, category text, name text, duration_s int,
                    distance_m numeric, avg_hr numeric, max_hr numeric, avg_power numeric, np_power numeric, kj numeric, kcal numeric, has_power boolean, load numeric)
             on conflict (user_id, provider, external_id) do update set start_time=excluded.start_time, day=excluded.day, sport=excluded.sport, category=excluded.category,
               name=excluded.name, duration_s=excluded.duration_s, distance_m=excluded.distance_m, avg_hr=excluded.avg_hr, max_hr=excluded.max_hr, avg_power=excluded.avg_power,
               np_power=excluded.np_power, kj=excluded.kj, kcal=excluded.kcal, has_power=excluded.has_power, load=excluded.load`,
      [userId, JSON.stringify(rows)]);
  }
  if (daily.length) {
    const cols = DAILY_COLS.filter((c) => daily.some((d) => d[c] != null));
    if (cols.length) {
      await q(`insert into daily_metrics (user_id, day, provider, ${cols.join(", ")})
               select $1, x.day, x.provider, ${cols.map((c) => "x." + c).join(", ")}
                 from jsonb_to_recordset($2::jsonb) as x(day date, provider text, ${cols.map((c) => `${c} ${c === "steps" ? "int" : "numeric"}`).join(", ")})
               on conflict (user_id, day, provider) do update set ${cols.map((c) => `${c}=coalesce(excluded.${c}, daily_metrics.${c})`).join(", ")}`,
        [userId, JSON.stringify(daily)]);
    }
  }
  return raw.length + activities.length + daily.length;
}

export async function syncConnection(conn, { full = false } = {}) {
  const p = SYNCABLE[conn.provider];
  if (!p || !p.configured()) return { ok: false, items: 0, message: "Quelle nicht eingerichtet" };
  const since = full || !conn.last_sync_at ? new Date(Date.now() - 365 * 864e5) : new Date(new Date(conn.last_sync_at).getTime() - 3 * 864e5);
  try {
    const token = await accessToken(conn);
    const batch = await p.fetchSince(token, since, conn);
    const items = await storeBatch(conn.user_id, conn.provider, batch);
    await q("update connections set last_sync_at=now(), last_error=null, status='active' where id=$1", [conn.id]);
    await q("insert into sync_runs (user_id, provider, ok, items, message) values ($1,$2,true,$3,$4)", [conn.user_id, conn.provider, items, full ? "voll" : "inkrementell"]);
    return { ok: true, items };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 300);
    await q("update connections set last_error=$1 where id=$2", [msg, conn.id]);
    await q("insert into sync_runs (user_id, provider, ok, items, message) values ($1,$2,false,0,$3)", [conn.user_id, conn.provider, msg]);
    return { ok: false, items: 0, message: msg };
  }
}

export async function syncUser(userId, opts) {
  const conns = await q("select * from connections where user_id=$1 and status <> 'disconnected'", [userId]);
  const out = [];
  for (const c of conns) out.push({ provider: c.provider, ...(await syncConnection(c, opts)) });
  return out;
}

export async function syncAll() {
  const conns = await q("select * from connections where status <> 'disconnected'");
  let ok = 0, fail = 0;
  for (const c of conns) { const r = await syncConnection(c); r.ok ? ok++ : fail++; }
  return { ok, fail };
}

export async function connectionFor(userId, provider) {
  return one("select * from connections where user_id=$1 and provider=$2", [userId, provider]);
}
