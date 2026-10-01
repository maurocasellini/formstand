// Alle Datenzugriffe. Ablage pro Konto getrennt:
//   db/users.json, db/settings.json, db/coach.json, db/sync_runs.json
//   db/u/<id>/connections.json  activities.json  daily.json  manual.json  media.json
//   db/u/<id>/raw/<quelle>/<art>.json   (Rohdaten der Schnittstellen, unverändert)
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { read, update, write, removePrefix } from "./store";
import { DEMO_ID, DEMO_USER, demoData } from "./demodata";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const U = (id, f) => { if (id === DEMO_ID) throw new Error("Die Demo ist schreibgeschützt."); return `u/${id}/${f}.json`; };
const isDemo = (id) => id === DEMO_ID;

// ---------- Konten ----------
const SEED = [
  { username: "ADMIN", name: "Admin", password: "ADMIN", role: "admin" },
  { username: "Mauro.Casellini", name: "Mauro Casellini", password: "MAURO", role: "admin", sport: "Rad & Laufen", email: "mauro.casellini@gmail.com" },
];

export async function listUsers() {
  let users = await read("users.json", []);
  if (!users.length) {
    users = await update("users.json", [], async (cur) => {
      if (cur.length) return cur;
      const out = [];
      for (const s of SEED) out.push({ id: uid(), username: s.username, email: s.email || null, name: s.name, role: s.role, sport: s.sport || null,
        weight_kg: null, birth_year: null, password_hash: await bcrypt.hash(s.password, 11), sver: 1, must_change: true, created_at: now() });
      return out;
    });
  }
  return users;
}
export const publicUser = (u) => u && { id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, sport: u.sport, weight_kg: u.weight_kg, height_cm: u.height_cm ?? null, birth_year: u.birth_year, must_change: Boolean(u.must_change), sver: u.sver, demo: Boolean(u.demo) };

export async function getUser(id) { if (isDemo(id)) return { ...DEMO_USER }; return (await listUsers()).find((u) => u.id === id) || null; }
export async function findUserByLogin(login) {
  const l = String(login || "").trim().toLowerCase();
  return (await listUsers()).find((u) => u.username.toLowerCase() === l || (u.email && u.email.toLowerCase() === l)) || null;
}
export async function createUser({ username, name, email, password, role = "athlete", sport = null }) {
  const hash = await bcrypt.hash(password, 11);
  let created = null;
  await update("users.json", [], (users) => {
    const l = username.toLowerCase();
    if (users.some((u) => u.username.toLowerCase() === l || (email && u.email && u.email.toLowerCase() === email.toLowerCase()))) throw new Error("Benutzername oder E-Mail gibt es schon.");
    created = { id: uid(), username, email: email || null, name, role, sport, weight_kg: null, birth_year: null, password_hash: hash, sver: 1, must_change: false, created_at: now() };
    users.push(created);
  });
  return created;
}
export async function updateUser(id, patch) {
  let out = null;
  await update("users.json", [], (users) => { const u = users.find((x) => x.id === id); if (u) { Object.assign(u, patch); out = u; } });
  return out;
}
export async function setPassword(id, password, { mustChange = false } = {}) {
  const hash = await bcrypt.hash(password, 11);
  return updateUser(id, { password_hash: hash, must_change: mustChange, sver: Date.now() });
}
export const checkPassword = (pw, hash) => bcrypt.compare(String(pw || ""), hash);
export async function deleteUser(id) {
  await update("users.json", [], (users) => users.filter((u) => u.id !== id));
  await update("coach.json", [], (p) => p.filter((x) => x.coach_id !== id && x.athlete_id !== id));
  await removePrefix(`u/${id}/`);
}

// ---------- Einstellungen (App-Schlüssel der Schnittstellen etc.) ----------
export const getSettings = () => read("settings.json", { registrationOpen: true, apps: {} });
export const updateSettings = (fn) => update("settings.json", { registrationOpen: true, apps: {} }, fn);

// ---------- Coach-Zuordnung ----------
export const listPairs = () => read("coach.json", []);
export async function setPair(coach_id, athlete_id, remove) {
  await update("coach.json", [], (p) => {
    const rest = p.filter((x) => !(x.coach_id === coach_id && x.athlete_id === athlete_id));
    return remove ? rest : [...rest, { coach_id, athlete_id }];
  });
}

// ---------- Verbindungen ----------
export const getConnections = async (userId) => (isDemo(userId) ? [...demoData().connections] : read(U(userId, "connections"), []));
export async function getConnection(userId, provider) { return (await getConnections(userId)).find((c) => c.provider === provider) || null; }
export async function saveConnection(userId, provider, patch) {
  let out;
  await update(U(userId, "connections"), [], (list) => {
    let c = list.find((x) => x.provider === provider);
    if (!c) { c = { provider, user_id: userId, created_at: now(), status: "active" }; list.push(c); }
    Object.assign(c, patch);
    out = c;
  });
  return out;
}
export const removeConnection = (userId, provider) => update(U(userId, "connections"), [], (l) => l.filter((c) => c.provider !== provider));
export async function allConnections() {
  const users = await listUsers(), out = [];
  for (const u of users) for (const c of await getConnections(u.id)) out.push({ ...c, user_id: u.id });
  return out;
}

// ---------- Workouts ----------
export const getActivities = async (userId) => (isDemo(userId) ? [...demoData().activities] : read(U(userId, "activities"), []));
export async function upsertActivities(userId, rows) {
  if (!rows.length) return;
  await update(U(userId, "activities"), [], (list) => {
    const idx = new Map(list.map((a, i) => [a.provider + "|" + a.external_id, i]));
    for (const r of rows) {
      const k = r.provider + "|" + r.external_id;
      if (idx.has(k)) list[idx.get(k)] = { ...list[idx.get(k)], ...r };
      else { idx.set(k, list.length); list.push(r); }
    }
    list.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  });
}
export const deleteActivity = (userId, provider, extId) => update(U(userId, "activities"), [], (l) => l.filter((a) => !(a.provider === provider && a.external_id === String(extId))));

// ---------- Tageswerte je Quelle ----------
export const getDaily = async (userId) => (isDemo(userId) ? [...demoData().daily] : read(U(userId, "daily"), []));
export async function upsertDaily(userId, rows) {
  if (!rows.length) return;
  await update(U(userId, "daily"), [], (list) => {
    const idx = new Map(list.map((d, i) => [d.provider + "|" + d.day, i]));
    for (const r of rows) {
      const k = r.provider + "|" + r.day;
      if (idx.has(k)) { const cur = list[idx.get(k)]; for (const [key, v] of Object.entries(r)) if (v != null) cur[key] = v; }
      else { idx.set(k, list.length); list.push({ ...r }); }
    }
    list.sort((a, b) => (a.day < b.day ? -1 : 1));
  });
}

// ---------- Manuelle Eingaben ----------
export const getManual = async (userId) => (isDemo(userId) ? [...demoData().manual] : read(U(userId, "manual"), []));
export async function addManual(userId, entry) {
  const e = { id: uid(), created_at: now(), ...entry };
  await update(U(userId, "manual"), [], (l) => { l.push(e); });
  return e;
}
export async function addManualMany(userId, entries) {
  await update(U(userId, "manual"), [], (l) => { for (const e of entries) l.push({ id: uid(), created_at: now(), ...e }); });
}
export const deleteManual = (userId, id) => update(U(userId, "manual"), [], (l) => l.filter((e) => e.id !== id));
// Einflussfaktoren je Tag komplett setzen (ersetzt die bisherigen Einträge dieser Tage): byDay = { "2026-09-30": [{ t: "alkohol", n: 2 }, …] }
export async function setTriggers(userId, byDay, by) {
  await update(U(userId, "manual"), [], (l) => {
    const days = new Set(Object.keys(byDay));
    const keep = l.filter((e) => !(e.kind === "trigger" && days.has(e.day)));
    for (const [day, list] of Object.entries(byDay)) for (const x of list) keep.push({ id: uid(), created_at: now(), day, kind: "trigger", value: x.n || 1, data: { t: x.t }, created_by: by });
    return keep;
  });
}
export const deleteManualBySource = (userId, mediaId) => update(U(userId, "manual"), [], (l) => l.filter((e) => e.source_media !== mediaId));

// Morgen-Check-in: ein Eintrag pro Tag (wird ersetzt)
export async function setCheckin(userId, day, data, by) {
  await update(U(userId, "manual"), [], (l) => [...l.filter((e) => !(e.kind === "checkin" && e.day === day)), { id: uid(), created_at: now(), day, kind: "checkin", value: null, data, created_by: by }]);
}

// Gefühlte Anstrengung pro Einheit: { "<quelle>|<id>": { rpe, region, day } }
export const getFeel = async (userId) => (isDemo(userId) ? { ...demoData().feel } : read(U(userId, "feel"), {}));
export const setFeel = (userId, key, entry) => update(U(userId, "feel"), {}, (all) => { all[key] = { ...all[key], ...entry, at: now() }; });

// Push-Abos (Morgen-Erinnerung)
export const getPushSubs = async (userId) => (isDemo(userId) ? [] : read(U(userId, "push"), []));
export const addPushSub = (userId, sub) => update(U(userId, "push"), [], (l) => [...l.filter((x) => x.endpoint !== sub.endpoint), { ...sub, created_at: now() }].slice(-5));
export const removePushSub = (userId, endpoint) => update(U(userId, "push"), [], (l) => l.filter((x) => x.endpoint !== endpoint));

// Ziele, Wettkämpfe, Schwächen, Verfügbarkeit
export const GOALS_DEFAULT = { focus: "performance", events: [], weaknesses: [], mainWeakness: null, daysPerWeek: 5, hoursPerWeek: 7, longDay: 6, note: "", targetWeight: null, targetBodyfat: null, rate: 0.5, swimsPerWeek: null };
export const getGoals = async (userId) => ({ ...GOALS_DEFAULT, ...(isDemo(userId) ? demoData().goals : await read(U(userId, "goals"), {})) });
export const updateGoals = (userId, fn) => update(U(userId, "goals"), {}, (g) => fn({ ...GOALS_DEFAULT, ...g }));

// Fotovergleiche (KI): { "<idA>|<idB>": { ...ergebnis, created_at } }
export const getPhotoCompares = async (userId) => (isDemo(userId) ? {} : read(U(userId, "photo_compare"), {}));
export const savePhotoCompare = (userId, key, r) => update(U(userId, "photo_compare"), {}, (all) => { all[key] = { ...r, created_at: now() }; });
// Körperanalysen aus Fotos, je Fototag (neueste zuerst gelesen)
export const getBodyAnalyses = async (userId) => (isDemo(userId) ? { ...(demoData().bodyAnalyses || {}) } : read(U(userId, "body_analysis"), {}));
export const saveBodyAnalysis = (userId, day, r) => update(U(userId, "body_analysis"), {}, (all) => { all[day] = { ...r, day, created_at: now() }; });

// ---------- Bilder & Dokumente ----------
export const getMedia = async (userId) => (isDemo(userId) ? [] : read(U(userId, "media"), []));
export async function addMedia(userId, m) { const e = { id: uid(), created_at: now(), ...m }; await update(U(userId, "media"), [], (l) => { l.push(e); }); return e; }
export const deleteMediaEntry = (userId, id) => update(U(userId, "media"), [], (l) => l.filter((e) => e.id !== id));
export async function updateMedia(userId, id, patch) { await update(U(userId, "media"), [], (l) => { const m = l.find((e) => e.id === id); if (m) Object.assign(m, patch); }); }

// ---------- KI-Empfehlungen (pro Tag eine, die letzten 60 Tage) ----------
export const getAdvice = async (userId) => (isDemo(userId) ? {} : read(U(userId, "advice"), {}));
export const saveAdvice = (userId, day, entry) => update(U(userId, "advice"), {}, (all) => {
  all[day] = entry;
  return Object.fromEntries(Object.entries(all).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 60));
});

// ---------- Rohdaten ----------
// Jeder Abruf wird als eigenes Archiv-Dokument abgelegt (keine Änderung bestehender Rohdaten).
export async function storeRaw(userId, provider, rows) {
  const byKind = new Map();
  for (const r of rows) { const k = String(r.kind).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80); if (!byKind.has(k)) byKind.set(k, []); byKind.get(k).push(r); }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [kind, list] of byKind) {
    await write(`u/${userId}/raw/${provider}/${kind}/${stamp}-${crypto.randomBytes(3).toString("hex")}.json`,
      list.map((r) => ({ id: String(r.external_id), payload: r.payload })));
  }
}

// ---------- Beispieldaten entfernen ----------
export async function clearDemoData(userId) {
  await update(U(userId, "activities"), [], (l) => l.filter((a) => !a.is_demo));
  await update(U(userId, "daily"), [], (l) => l.filter((d) => !d.is_demo));
  await update(U(userId, "manual"), [], (l) => l.filter((e) => !e.is_demo));
  await update(U(userId, "feel"), {}, (all) => Object.fromEntries(Object.entries(all).filter(([, v]) => !v.is_demo)));
}

// ---------- Abgleich-Protokoll ----------
export const listRuns = () => read("sync_runs.json", []);
export const addRun = (run) => update("sync_runs.json", [], (l) => [{ ...run, started_at: now() }, ...l].slice(0, 200));
export { write };

// ---------- KI-Feedback zu Zeiträumen (Woche, Monat, Gesamtbild) ----------
export const getFeedback = async (userId) => (isDemo(userId) ? {} : read(U(userId, "feedback"), {}));
export const saveFeedback = (userId, key, entry) => update(U(userId, "feedback"), {}, (all) => {
  all[key] = { ...entry, created_at: now() };
  // nur die letzten 40 behalten
  const keys = Object.keys(all).sort((a, b) => (all[a].created_at < all[b].created_at ? 1 : -1));
  for (const k of keys.slice(40)) delete all[k];
});
