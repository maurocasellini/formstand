import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";
import { adviceForAll } from "@/lib/coach";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Täglicher Abgleich aller Verbindungen (Vercel Cron), danach die KI-Empfehlung für den Tag.
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sync = await syncAll();
  let advice;
  try { advice = await adviceForAll(); } catch (e) { advice = { error: String(e.message || e) }; }
  return NextResponse.json({ sync, advice });
}
