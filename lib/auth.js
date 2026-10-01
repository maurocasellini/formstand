import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { q, one, hasDb } from "./db";

const COOKIE = "fs_session";
const DAYS = 30;

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw) { return bcrypt.hash(pw, 11); }
export async function checkPassword(pw, hash) { return bcrypt.compare(pw, hash); }

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DAYS * 864e5);
  await q("insert into sessions (user_id, token_hash, expires_at) values ($1,$2,$3)", [userId, sha(token), expires]);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t && hasDb) await q("delete from sessions where token_hash = $1", [sha(t)]);
  jar.delete(COOKIE);
}

export async function currentUser() {
  if (!hasDb) return null;
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t) return null;
  return one(
    `select u.id, u.email, u.name, u.role, u.sport, u.weight_kg, u.birth_year
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`, [sha(t)]);
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/heute");
  return u;
}

// Wessen Daten werden angezeigt? Admin: alle, Coach: zugewiesene Sportler, sonst nur eigene.
export async function resolveSubject(viewer, requestedId) {
  if (!requestedId || requestedId === viewer.id) return viewer;
  if (viewer.role === "admin") return (await one("select id, email, name, role, sport, weight_kg, birth_year from users where id=$1", [requestedId])) || viewer;
  if (viewer.role === "coach") {
    const ok = await one("select 1 from coach_athletes where coach_id=$1 and athlete_id=$2", [viewer.id, requestedId]);
    if (ok) return one("select id, email, name, role, sport, weight_kg, birth_year from users where id=$1", [requestedId]);
  }
  return viewer;
}

export async function visibleAthletes(viewer) {
  if (viewer.role === "admin") return q("select id, name, sport from users order by name");
  if (viewer.role === "coach") return q("select u.id, u.name, u.sport from coach_athletes c join users u on u.id=c.athlete_id where c.coach_id=$1 order by u.name", [viewer.id]);
  return [];
}
