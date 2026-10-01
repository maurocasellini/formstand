import { cookies } from "next/headers";
import { readFile } from "@/lib/files";
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
  const buf = await readFile(m.pathname);
  if (!buf) return new Response("Nicht gefunden", { status: 404 });
  return new Response(buf, { headers: { "content-type": m.content_type || "application/octet-stream", "cache-control": "private, max-age=3600" } });
}
