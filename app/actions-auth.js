"use server";
import { redirect } from "next/navigation";
import * as repo from "@/lib/repo";
import { createSession, destroySession, requireUser } from "@/lib/auth";

export async function login(_prev, form) {
  const u = await repo.findUserByLogin(form.get("login"));
  if (!u || !(await repo.checkPassword(form.get("password"), u.password_hash))) return { error: "Benutzername oder Passwort stimmt nicht." };
  // Start-Konto ADMIN mit Startpasswort: gesperrt, sobald ein anderer Admin ein eigenes Passwort hat
  if (u.username === "ADMIN" && u.must_change && (await repo.listUsers()).some((x) => x.id !== u.id && x.role === "admin" && !x.must_change))
    return { error: "Dieses Start-Konto ist aus Sicherheitsgründen gesperrt. Bitte mit deinem eigenen Admin-Konto anmelden." };
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
