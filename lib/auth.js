import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { getUser, listPairs, listUsers, publicUser } from "./repo";
import { hasStore } from "./store";

const COOKIE = "fs_session";
const DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!s) throw new Error("SESSION_SECRET oder ENCRYPTION_KEY fehlt");
  return s;
}
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

// Signiertes Cookie: Konto-ID + Version (wird bei Passwortwechsel ungültig) + Ablauf
export async function createSession(user) {
  const exp = Date.now() + DAYS * 864e5;
  const body = Buffer.from(JSON.stringify({ u: user.id, v: user.sver, e: exp })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(exp) });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete("fs_subject");
}

export async function currentUser() {
  if (!hasStore) return null;
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t || !t.includes(".")) return null;
  const [body, sig] = t.split(".");
  const expect = sign(body);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let s; try { s = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
  if (!s.e || s.e < Date.now()) return null;
  const u = await getUser(s.u);
  if (!u || u.sver !== s.v) return null;
  return publicUser(u);
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

// Wessen Daten werden angezeigt? Admin: alle, Coach: zugeordnete Sportler, sonst nur eigene.
export async function resolveSubject(viewer, requestedId) {
  if (!requestedId || requestedId === viewer.id) return viewer;
  if (viewer.role === "admin") return publicUser(await getUser(requestedId)) || viewer;
  if (viewer.role === "coach") {
    const ok = (await listPairs()).some((p) => p.coach_id === viewer.id && p.athlete_id === requestedId);
    if (ok) return publicUser(await getUser(requestedId)) || viewer;
  }
  return viewer;
}

export async function visibleAthletes(viewer) {
  const users = await listUsers();
  if (viewer.role === "admin") return users.map((u) => ({ id: u.id, name: u.name, sport: u.sport })).sort((a, b) => a.name.localeCompare(b.name));
  if (viewer.role === "coach") {
    const ids = new Set((await listPairs()).filter((p) => p.coach_id === viewer.id).map((p) => p.athlete_id));
    return users.filter((u) => ids.has(u.id)).map((u) => ({ id: u.id, name: u.name, sport: u.sport }));
  }
  return [];
}
