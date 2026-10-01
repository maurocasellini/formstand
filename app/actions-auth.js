"use server";
import { redirect } from "next/navigation";
import { q, one } from "@/lib/db";
import { hashPassword, checkPassword, createSession, destroySession } from "@/lib/auth";

export async function login(_prev, form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  const u = await one("select id, password_hash from users where email=$1", [email]);
  if (!u || !(await checkPassword(pw, u.password_hash))) return { error: "E-Mail oder Passwort stimmt nicht." };
  await createSession(u.id);
  redirect("/heute");
}

// Erstes Konto = Admin. Danach legt nur der Admin Konten an.
export async function setupAdmin(_prev, form) {
  const c = await one("select count(*)::int as n from users");
  if (c.n > 0) return { error: "Es gibt bereits ein Admin-Konto. Bitte anmelden." };
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  if (!name || !email.includes("@")) return { error: "Name und gültige E-Mail angeben." };
  if (pw.length < 10) return { error: "Passwort mit mindestens 10 Zeichen wählen." };
  const u = await one("insert into users (email, name, password_hash, role) values ($1,$2,$3,'admin') returning id", [email, name, await hashPassword(pw)]);
  await createSession(u.id);
  redirect("/heute");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
