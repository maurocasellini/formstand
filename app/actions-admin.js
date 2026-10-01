"use server";
import { revalidatePath } from "next/cache";
import { q, one } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";

export async function createUser(_prev, form) {
  await requireAdmin();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const pw = String(form.get("password") || "");
  const role = ["admin", "athlete", "coach"].includes(String(form.get("role"))) ? String(form.get("role")) : "athlete";
  if (!name || !email.includes("@")) return { error: "Name und gültige E-Mail angeben." };
  if (pw.length < 10) return { error: "Startpasswort mit mindestens 10 Zeichen." };
  if (await one("select 1 from users where email=$1", [email])) return { error: "Diese E-Mail gibt es schon." };
  await q("insert into users (email, name, password_hash, role, sport) values ($1,$2,$3,$4,$5)", [email, name, await hashPassword(pw), role, String(form.get("sport") || "") || null]);
  revalidatePath("/admin");
  return { ok: `${name} angelegt. Startpasswort weitergeben.` };
}

export async function setRole(form) {
  const me = await requireAdmin();
  const id = String(form.get("id")), role = String(form.get("role"));
  if (id === me.id || !["admin", "athlete", "coach"].includes(role)) return;
  await q("update users set role=$1 where id=$2", [role, id]);
  revalidatePath("/admin");
}

export async function resetPassword(_prev, form) {
  await requireAdmin();
  const pw = String(form.get("password") || "");
  if (pw.length < 10) return { error: "Mindestens 10 Zeichen." };
  await q("update users set password_hash=$1 where id=$2", [await hashPassword(pw), String(form.get("id"))]);
  await q("delete from sessions where user_id=$1", [String(form.get("id"))]);
  return { ok: "Passwort gesetzt." };
}

export async function deleteUser(form) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  if (id === me.id) return;
  if (String(form.get("confirm")) !== "LÖSCHEN") return;
  await q("delete from users where id=$1", [id]);
  revalidatePath("/admin");
}

export async function assignCoach(form) {
  await requireAdmin();
  const coach = String(form.get("coach")), athlete = String(form.get("athlete"));
  if (!coach || !athlete || coach === athlete) return;
  if (form.get("remove")) await q("delete from coach_athletes where coach_id=$1 and athlete_id=$2", [coach, athlete]);
  else await q("insert into coach_athletes (coach_id, athlete_id) values ($1,$2) on conflict do nothing", [coach, athlete]);
  revalidatePath("/admin");
}
