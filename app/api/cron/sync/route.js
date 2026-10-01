import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";
import { morningPush, reviewPush } from "@/lib/push";
import { weeklyBriefs } from "@/lib/coach";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Täglicher Abgleich aller Verbindungen (Vercel Cron), danach Morgen-Erinnerung und Rückblicke. Die KI-Erklärung entsteht erst nach dem Check-in.
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sync = await syncAll();
  let push;
  try { push = await morningPush(); } catch (e) { push = { error: String(e.message || e) }; }
  let reviews;
  try { reviews = await reviewPush(); } catch (e) { reviews = { error: String(e.message || e) }; }
  // Montags: Wochenbrief der KI für alle mit frischen Daten
  let briefs = null;
  if (new Date().getUTCDay() === 1) { try { briefs = await weeklyBriefs(); } catch (e) { briefs = { error: String(e.message || e) }; } }
  return NextResponse.json({ sync, push, reviews, briefs });
}
