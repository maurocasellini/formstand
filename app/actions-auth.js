"use server";
import { redirect } from "next/navigation";
import * as repo from "@/lib/repo";
import crypto from "node:crypto";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { seedDemo } from "@/lib/demo";
import { todayIso } from "@/lib/metrics";

export async function login(_prev, form) {
  const u = await repo.findUserByLogin(form.get("login"));
  if (!u || !(await repo.checkPassword(form.get("password"), u.password_hash))) return { error: "Benutzername oder Passwort stimmt nicht." };
  await createSession(u);
  redirect(u.must_change ? "/konto?neu=1" : "/heute");
}

const NAME_OK = /^[A-Za-z0-9._-]{3,40}$/;
export async function register(_prev, form) {
  const s = await repo.getSettings();
  if (!s.registrationOpen) return { error: "Die Registrierung ist geschlossen. Bitte beim Admin melden." };
  const username = String(form.get("username") || "").trim();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase() || null;
  const pw = String(form.get("password") || "");
  if (!NAME_OK.test(username)) return { error: "Benutzername: 3–40 Zeichen, nur Buchstaben, Zahlen, Punkt, Strich." };
  if (!name) return { error: "Bitte deinen Namen angeben." };
  if (email && !email.includes("@")) return { error: "E-Mail sieht nicht gültig aus." };
  if (pw.length < 8) return { error: "Passwort mit mindestens 8 Zeichen wählen." };
  let u;
  try { u = await repo.createUser({ username, name, email, password: pw, role: "athlete" }); } catch (e) { return { error: e.message }; }
  await createSession(u);
  redirect("/quellen?ok=" + encodeURIComponent("Willkommen! Verbinde jetzt deine Apps."));
}

const DEMO = { error: "Im Demo-Konto nicht möglich." };

export async function changePassword(_prev, form) {
  const me = await requireUser();
  if (me.demo) return DEMO;
  const full = await repo.getUser(me.id);
  const cur = String(form.get("current") || ""), pw = String(form.get("password") || ""), pw2 = String(form.get("password2") || "");
  if (!(await repo.checkPassword(cur, full.password_hash))) return { error: "Das aktuelle Passwort stimmt nicht." };
  if (pw.length < 8) return { error: "Neues Passwort mit mindestens 8 Zeichen." };
  if (pw !== pw2) return { error: "Die beiden neuen Passwörter sind nicht gleich." };
  const u = await repo.setPassword(me.id, pw);
  await createSession(u);
  return { ok: "Passwort geändert." };
}

export async function updateAccount(_prev, form) {
  const me = await requireUser();
  if (me.demo) return DEMO;
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase() || null;
  if (!name) return { error: "Name darf nicht leer sein." };
  const others = (await repo.listUsers()).filter((u) => u.id !== me.id);
  if (email && others.some((u) => u.email && u.email.toLowerCase() === email)) return { error: "Diese E-Mail nutzt schon jemand." };
  await repo.updateUser(me.id, { name, email });
  return { ok: "Gespeichert." };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// Demo: gemeinsames Konto mit Beispieldaten, nur zum Anschauen. Daten werden täglich frisch erzeugt.
export async function startDemo() {
  let u = (await repo.listUsers()).find((x) => x.demo);
  if (!u) {
    try { u = await repo.createUser({ username: "demo-konto", name: "Alex Demo", password: crypto.randomBytes(24).toString("hex"), role: "athlete", sport: "Rad & Laufen" }); }
    catch { u = await repo.findUserByLogin("demo-konto"); }
    u = await repo.updateUser(u.id, { demo: true, weight_kg: 76, birth_year: 1990 });
  }
  const today = todayIso();
  const DEMO_VERSION = 4; // erhöhen, wenn sich die Beispieldaten ändern
  if (u.demo_day !== today || u.demo_ver !== DEMO_VERSION) {
    await seedDemo(u.id, 76, { rich: true });
    u = await repo.updateUser(u.id, { demo_day: today, demo_ver: DEMO_VERSION });
  }
  await createSession(u);
  redirect("/heute");
}

export async function leaveDemo() {
  await destroySession();
  redirect("/register");
}
