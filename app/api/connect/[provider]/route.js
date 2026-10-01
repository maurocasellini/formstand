import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { OAUTH } from "@/lib/providers";
import { appCreds } from "@/lib/apps";
import { randomState } from "@/lib/crypto";
import { baseUrl } from "@/lib/baseurl";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { provider } = await params;
  const user = await currentUser();
  const base = await baseUrl();
  if (!user) return NextResponse.redirect(`${base}/login`);
  const p = OAUTH[provider], c = await appCreds(provider);
  if (!p || !c.clientId || !c.clientSecret) return NextResponse.redirect(`${base}/quellen?error=${encodeURIComponent(`${provider} ist noch nicht freigeschaltet (Admin → Schnittstellen)`)}`);
  const state = randomState();
  (await cookies()).set("fs_oauth", `${provider}:${state}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: true });
  return NextResponse.redirect(p.authUrl(state, `${base}/api/oauth/${provider}`, c));
}
