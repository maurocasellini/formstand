import { cookies } from "next/headers";
import { requireUser, resolveSubject, visibleAthletes } from "./auth";
import { DEMO_USER } from "./demodata";

// Angemeldete Person + wessen Daten angezeigt werden (Admin/Coach können wechseln).
export async function viewerAndSubject() {
  const viewer = await requireUser();
  const jar = await cookies();
  const subject = await resolveSubject(viewer, jar.get("fs_subject")?.value);
  const athletes = await visibleAthletes(viewer);
  return { viewer, subject, athletes, own: subject.id === viewer.id };
}

// Seiten-Kontext: eingeloggt (normal) oder öffentliche Demo (/demo, ohne Anmeldung, schreibgeschützt)
export async function pageContext(demo) {
  if (demo) { const u = { ...DEMO_USER }; return { viewer: u, subject: u, athletes: [], own: false, demo: true, base: "/demo" }; }
  return { ...(await viewerAndSubject()), demo: false, base: "" };
}
