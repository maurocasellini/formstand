import { cookies } from "next/headers";
import { get } from "@vercel/blob";
import { currentUser, resolveSubject } from "@/lib/auth";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

// Private Dateien nur über das eigene Konto (oder Admin/Coach) ausliefern.
export async function GET(_req, { params }) {
  const viewer = await currentUser();
  if (!viewer) return new Response("Nicht angemeldet", { status: 401 });
  const subject = await resolveSubject(viewer, (await cookies()).get("fs_subject")?.value);
  const { id } = await params;
  const m = (await repo.getMedia(subject.id)).find((x) => x.id === id);
  if (!m) return new Response("Nicht gefunden", { status: 404 });
  const r = await get(m.pathname, { access: "private" });
  if (!r || r.statusCode !== 200) return new Response("Nicht gefunden", { status: 404 });
  return new Response(r.stream, { headers: { "content-type": m.content_type || "application/octet-stream", "cache-control": "private, max-age=3600" } });
}
