// Web-Push für die Morgen-Erinnerung. Die Schlüssel (VAPID) erzeugt Formstand selbst und speichert sie verschlüsselt.
import webpush from "web-push";
import * as repo from "./repo";
import { encrypt, decrypt } from "./crypto";
import { todayIso } from "./metrics";
import { todayModel } from "./coach";
import { review } from "./adherence";
import { periodReview, reviewText } from "./weekly";
import { weekPlan, mondayOf } from "./plan";

export async function vapid() {
  let s = await repo.getSettings();
  if (!s.push?.publicKey) {
    const k = webpush.generateVAPIDKeys();
    s = await repo.updateSettings((x) => { if (!x.push?.publicKey) x.push = { publicKey: k.publicKey, privateKey: encrypt(k.privateKey) }; return x; });
  }
  return { publicKey: s.push.publicKey, privateKey: decrypt(s.push.privateKey) };
}

export async function sendTo(userId, payload) {
  const subs = await repo.getPushSubs(userId);
  if (!subs.length) return 0;
  const { publicKey, privateKey } = await vapid();
  const subject = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "mailto:noreply@formstand.app";
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { vapidDetails: { subject, publicKey, privateKey }, TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await repo.removePushSub(userId, sub.endpoint);
    }
  }
  return sent;
}

// Jeden Morgen: Erinnerung an den Check-in, mit Tagesempfehlung falls vorhanden.
export async function morningPush() {
  const today = todayIso();
  let sent = 0;
  for (const u of await repo.listUsers()) {
    if (u.demo || !(await repo.getPushSubs(u.id)).length) continue;
    const done = (await repo.getManual(u.id)).some((m) => m.kind === "checkin" && m.day === today);
    if (done) continue;
    let d = null; try { d = (await todayModel(u.id)).decision; } catch {}
    sent += await sendTo(u.id, {
      title: `Guten Morgen, ${u.name.split(" ")[0]}`,
      body: d ? `Vorschlag: ${d.title}. Kurz einchecken (5 Sekunden), dann passt Formstand ihn an.` : "Wie fühlst du dich heute? 4 Fragen, 5 Sekunden.",
      url: "/heute#checkin", tag: `checkin-${today}`,
    });
  }
  return { sent };
}

// Montags Wochenrückblick, am 1. des Monats Monatsrückblick
export async function reviewPush() {
  const today = todayIso(), dow = new Date(today + "T12:00:00Z").getUTCDay(), first = today.endsWith("-01");
  if (dow !== 1 && !first) return { skipped: true };
  const add = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  let sent = 0;
  for (const u of await repo.listUsers()) {
    if (u.demo || !(await repo.getPushSubs(u.id)).length) continue;
    try {
      const m = await todayModel(u.id);
      const rows = review(m.all, { ...m.ctx, goals: m.hasGoals ? m.goals : null }, first ? 35 : 8);
      if (dow === 1) {
        const p = periodReview(m.all, rows, add(today, -7), add(today, -1));
        const next = weekPlan(m.goals, mondayOf(today), m.user || {}, m.zones);
        const key = next.items.filter((x) => x.type === "quality" || x.type === "race").map((x) => x.title.replace("Wettkampf: ", "")).slice(0, 3).join(", ");
        sent += await sendTo(u.id, { title: "Deine Woche", body: `${reviewText(p, "Letzte Woche")}. Diese Woche: ${next.phase.label}${key ? ` – ${key}` : ""}.`, url: "/ziele", tag: `week-${today}` });
      }
      if (first) {
        const from = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
        const p = periodReview(m.all, rows, from, add(today, -1));
        sent += await sendTo(u.id, { title: "Dein Monat", body: `${reviewText(p, "Letzter Monat")}${p.weightDelta != null ? ` · Gewicht ${p.weightDelta > 0 ? "+" : ""}${p.weightDelta} kg` : ""}.`, url: "/entwicklung", tag: `month-${today}` });
      }
    } catch {}
  }
  return { sent };
}
