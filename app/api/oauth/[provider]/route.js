import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { OAUTH } from "@/lib/providers";
import { appCreds } from "@/lib/apps";
import { encrypt } from "@/lib/crypto";
import * as repo from "@/lib/repo";
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
    const t = await p.exchange(u.searchParams.get("code"), `${base}/api/oauth/${provider}`, await appCreds(provider));
    const conn = await repo.saveConnection(user.id, provider, {
      external_id: t.external_id || null, access_token: encrypt(t.access_token), refresh_token: encrypt(t.refresh_token),
      expires_at: new Date(t.expires_at).toISOString(), scope: t.scope || null, status: "active", last_error: null,
    });
    after(() => syncConnection({ ...conn, user_id: user.id }, { full: true }));
    return back(`${p.name} verbunden. Die letzten 12 Monate werden im Hintergrund geladen.`, true);
  } catch (e) {
    return back(String(e.message || e));
  }
}
