import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

export const hasDb = Boolean(url);

let _sql = null;
function client() {
  if (!url) throw new Error("DATABASE_URL fehlt. In Vercel unter Storage eine Neon-Datenbank verbinden.");
  if (!_sql) {
    // Lokal (Tests) mit normalem Postgres, in Produktion Neon über HTTP
    if (process.env.LOCAL_PG === "1") {
      const pool = new (require("pg").Pool)({ connectionString: url });
      _sql = { query: async (t, p) => (await pool.query(t, p)).rows };
    } else _sql = neon(url);
  }
  return _sql;
}

// Parametrisierte Abfrage: q("select * from users where id = $1", [id])
export async function q(text, params = []) {
  await ensureSchema();
  return client().query(text, params);
}
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}

const SCHEMA = [
  `create extension if not exists pgcrypto`,
  `create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    name text not null,
    password_hash text not null,
    role text not null default 'athlete' check (role in ('admin','athlete','coach')),
    sport text,
    weight_kg numeric,
    birth_year int,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text unique not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists coach_athletes (
    coach_id uuid not null references users(id) on delete cascade,
    athlete_id uuid not null references users(id) on delete cascade,
    primary key (coach_id, athlete_id)
  )`,
  // Verbindungen zu APIs (Tokens verschlüsselt)
  `create table if not exists connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    external_id text,
    access_token text,
    refresh_token text,
    expires_at timestamptz,
    scope text,
    status text not null default 'active',
    last_sync_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    unique (user_id, provider)
  )`,
  // 1) Automatisch per API: Rohdaten unverändert
  `create table if not exists raw_events (
    id bigserial primary key,
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    kind text not null,
    external_id text not null,
    payload jsonb not null,
    fetched_at timestamptz not null default now(),
    unique (user_id, provider, kind, external_id)
  )`,
  // normalisierte Workouts
  `create table if not exists activities (
    id bigserial primary key,
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    external_id text not null,
    start_time timestamptz not null,
    day date not null,
    sport text,
    category text not null default 'end' check (category in ('end','str','other')),
    name text,
    duration_s int not null default 0,
    distance_m numeric,
    avg_hr numeric,
    max_hr numeric,
    avg_power numeric,
    np_power numeric,
    kj numeric,
    kcal numeric,
    has_power boolean not null default false,
    load numeric not null default 0,
    is_demo boolean not null default false,
    unique (user_id, provider, external_id)
  )`,
  `create index if not exists activities_user_day on activities(user_id, day)`,
  // normalisierte Tageswerte je Quelle
  `create table if not exists daily_metrics (
    user_id uuid not null references users(id) on delete cascade,
    day date not null,
    provider text not null,
    recovery_score numeric,
    hrv numeric,
    rhr numeric,
    sleep_h numeric,
    strain numeric,
    steps int,
    is_demo boolean not null default false,
    primary key (user_id, day, provider)
  )`,
  // 2) Manuelle Eingaben
  `create table if not exists manual_entries (
    id bigserial primary key,
    user_id uuid not null references users(id) on delete cascade,
    day date not null,
    kind text not null,
    value numeric,
    unit text,
    data jsonb not null default '{}'::jsonb,
    created_by uuid references users(id) on delete set null,
    is_demo boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists manual_user_day on manual_entries(user_id, day)`,
  // 3) Bilder & Dokumente
  `create table if not exists media (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    kind text not null,
    day date not null,
    pathname text not null,
    content_type text,
    size_bytes int,
    note text,
    extracted jsonb,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists sync_runs (
    id bigserial primary key,
    user_id uuid references users(id) on delete cascade,
    provider text,
    started_at timestamptz not null default now(),
    ok boolean,
    items int,
    message text
  )`,
];

let ready = null;
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const sql = client();
      for (const stmt of SCHEMA) await sql.query(stmt);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
