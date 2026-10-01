import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { after } from "next/server";
import { currentUser } from "@/lib/auth";
import { OAUTH } from "@/lib/providers";
import { encrypt } from "@/lib/crypto";
import { q, one } from "@/lib/db";
import { syncConnection } from "@/lib/sync";
import { baseUrl } from "@/lib/baseurl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req, { params }) {
  const { provider } = await params;
  const base = await baseUrl();
  const back = (msg, ok) => NextResponse.redirect(`${base}/quellen?${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);
  const u = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("fs_oauth")?.value;
  jar.delete("fs_oauth");
  if (u.searchParams.get("error")) return back(`Anmeldung bei ${provider} abgebrochen`);
  if (!expected || expected !== `${provider}:${u.searchParams.get("state")}`) return back("Sicherheitsprüfung fehlgeschlagen, bitte erneut verbinden");
  const p = OAUTH[provider];
  if (!p) return back("Unbekannte Quelle");
  try {
    const t = await p.exchange(u.searchParams.get("code"), `${base}/api/oauth/${provider}`);
    await q(`insert into connections (user_id, provider, external_id, access_token, refresh_token, expires_at, scope, status)
             values ($1,$2,$3,$4,$5,$6,$7,'active')
             on conflict (user_id, provider) do update set external_id=excluded.external_id, access_token=excluded.access_token,
               refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, scope=excluded.scope, status='active', last_error=null`,
      [user.id, provider, t.external_id || null, encrypt(t.access_token), encrypt(t.refresh_token), t.expires_at, t.scope || null]);
    const conn = await one("select * from connections where user_id=$1 and provider=$2", [user.id, provider]);
    after(() => syncConnection(conn, { full: true }));
    return back(`${p.name} verbunden. Die letzten 12 Monate werden im Hintergrund geladen.`, true);
  } catch (e) {
    return back(String(e.message || e));
  }
}
