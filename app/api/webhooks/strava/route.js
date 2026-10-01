import { NextResponse, after } from "next/server";
import { one, q } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { strava } from "@/lib/providers/strava";
import { storeBatch, syncConnection } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Strava-Webhook: Bestätigung der Subscription
export async function GET(req) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === process.env.STRAVA_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": u.searchParams.get("hub.challenge") });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// Neue/geänderte/gelöschte Aktivität → sofort abholen
export async function POST(req) {
  const ev = await req.json().catch(() => null);
  if (!ev || ev.object_type !== "activity") return NextResponse.json({ ok: true });
  const conn = await one("select * from connections where provider='strava' and external_id=$1", [String(ev.owner_id)]);
  if (!conn) return NextResponse.json({ ok: true });
  after(async () => {
    try {
      if (ev.aspect_type === "delete") { await q("delete from activities where user_id=$1 and provider='strava' and external_id=$2", [conn.user_id, String(ev.object_id)]); return; }
      if (new Date(conn.expires_at).getTime() < Date.now() + 120000) { await syncConnection(conn); return; }
      await storeBatch(conn.user_id, "strava", await strava.fetchOne(decrypt(conn.access_token), ev.object_id));
    } catch (e) { console.error("strava webhook", e); }
  });
  return NextResponse.json({ ok: true });
}
