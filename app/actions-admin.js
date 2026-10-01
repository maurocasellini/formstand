"use server";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import * as repo from "@/lib/repo";
import { requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

const NAME_OK = /^[A-Za-z0-9._-]{3,40}$/;

export async function createUser(_prev, form) {
  await requireAdmin();
  const username = String(form.get("username") || "").trim();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase() || null;
  const pw = String(form.get("password") || "");
  const role = ["admin", "athlete", "coach"].includes(String(form.get("role"))) ? String(form.get("role")) : "athlete";
  if (!NAME_OK.test(username)) return { error: "Benutzername: 3–40 Zeichen, nur Buchstaben, Zahlen, Punkt, Strich." };
  if (!name) return { error: "Name angeben." };
  if (pw.length < 6) return { error: "Startpasswort mit mindestens 6 Zeichen." };
  try {
    const u = await repo.createUser({ username, name, email, password: pw, role, sport: String(form.get("sport") || "") || null });
    await repo.updateUser(u.id, { must_change: true });
  } catch (e) { return { error: e.message }; }
  revalidatePath("/admin");
  return { ok: `${name} angelegt. Benutzername und Startpasswort weitergeben.` };
}

export async function setRole(form) {
  const me = await requireAdmin();
  const id = String(form.get("id")), role = String(form.get("role"));
  if (id === me.id || !["admin", "athlete", "coach"].includes(role)) return;
  await repo.updateUser(id, { role });
  revalidatePath("/admin");
}

export async function resetPassword(_prev, form) {
  await requireAdmin();
  const pw = String(form.get("password") || "");
  if (pw.length < 6) return { error: "Mindestens 6 Zeichen." };
  await repo.setPassword(String(form.get("id")), pw, { mustChange: true });
  return { ok: "Passwort gesetzt." };
}

export async function deleteUser(form) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (id === me.id || String(form.get("confirm")) !== "LÖSCHEN") return;
  await repo.deleteUser(id);
  revalidatePath("/admin");
}

export async function assignCoach(form) {
  await requireAdmin();
  const coach = String(form.get("coach")), athlete = String(form.get("athlete"));
  if (!coach || !athlete || coach === athlete) return;
  await repo.setPair(coach, athlete, Boolean(form.get("remove")));
  revalidatePath("/admin");
}

export async function saveApp(_prev, form) {
  await requireAdmin();
  const provider = String(form.get("provider"));
  if (provider === "anthropic") {
    const apiKey = String(form.get("apiKey") || "").trim();
    const model = String(form.get("model") || "").trim().slice(0, 80);
    if (apiKey && !apiKey.startsWith("sk-ant-")) return { error: "Das sieht nicht nach einem Claude-API-Schlüssel aus (beginnt mit sk-ant-)." };
    const cur = (await repo.getSettings()).apps?.anthropic || {};
    if (!apiKey && !cur.apiKey) return { error: "API-Schlüssel eintragen." };
    if (apiKey) {
      const res = await fetch(`${process.env.ANTHROPIC_BASE || "https://api.anthropic.com/v1"}/models`, { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } }).catch(() => null);
      if (res && (res.status === 401 || res.status === 403)) return { error: "Claude lehnt den Schlüssel ab. Bitte prüfen." };
    }
    await repo.updateSettings((s) => {
      s.apps = s.apps || {};
      const a = s.apps.anthropic || {};
      if (apiKey) a.apiKey = encrypt(apiKey);
      a.model = model || null;
      s.apps.anthropic = a;
      return s;
    });
    revalidatePath("/", "layout");
    return { ok: "Gespeichert." };
  }
  if (!["strava", "whoop"].includes(provider)) return { error: "Unbekannte Schnittstelle." };
  const clientId = String(form.get("clientId") || "").trim();
  const clientSecret = String(form.get("clientSecret") || "").trim();
  if (!clientId && !clientSecret) return { error: "Client ID und Secret eintragen." };
  await repo.updateSettings((s) => {
    s.apps = s.apps || {};
    const cur = s.apps[provider] || {};
    if (clientId) cur.clientId = clientId;
    if (clientSecret) cur.clientSecret = encrypt(clientSecret);
    if (provider === "strava" && !cur.verifyToken) cur.verifyToken = crypto.randomBytes(16).toString("hex");
    s.apps[provider] = cur;
    return s;
  });
  revalidatePath("/admin");
  revalidatePath("/quellen");
  return { ok: "Gespeichert." };
}

export async function removeApp(form) {
  await requireAdmin();
  const provider = String(form.get("provider"));
  await repo.updateSettings((s) => { if (s.apps) delete s.apps[provider]; return s; });
  revalidatePath("/admin");
}

export async function setRegistration(form) {
  await requireAdmin();
  await repo.updateSettings((s) => ({ ...s, registrationOpen: form.get("open") === "1" }));
  revalidatePath("/admin");
}
