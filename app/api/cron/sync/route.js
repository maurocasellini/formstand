import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";
import { adviceForAll } from "@/lib/coach";
import { morningPush, reviewPush } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Täglicher Abgleich aller Verbindungen (Vercel Cron), danach KI-Empfehlung und Morgen-Erinnerung.
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sync = await syncAll();
  let advice;
  try { advice = await adviceForAll(); } catch (e) { advice = { error: String(e.message || e) }; }
  let push;
  try { push = await morningPush(); } catch (e) { push = { error: String(e.message || e) }; }
  let reviews;
  try { reviews = await reviewPush(); } catch (e) { reviews = { error: String(e.message || e) }; }
  return NextResponse.json({ sync, advice, push, reviews });
}
