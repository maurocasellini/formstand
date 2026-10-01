import { cookies } from "next/headers";
import { get } from "@vercel/blob";
import { currentUser, resolveSubject } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

// Private Dateien nur über das eigene Konto (oder Admin/Coach) ausliefern.
export async function GET(_req, { params }) {
  const viewer = await currentUser();
  if (!viewer) return new Response("Nicht angemeldet", { status: 401 });
  const subject = await resolveSubject(viewer, (await cookies()).get("fs_subject")?.value);
  const { id } = await params;
  const m = await one("select pathname, content_type, user_id from media where id=$1", [id]);
  if (!m || m.user_id !== subject.id) return new Response("Nicht gefunden", { status: 404 });
  const r = await get(m.pathname, { access: "private" });
  if (!r) return new Response("Nicht gefunden", { status: 404 });
  return new Response(r.stream, { headers: { "content-type": m.content_type || "application/octet-stream", "cache-control": "private, max-age=3600" } });
}
