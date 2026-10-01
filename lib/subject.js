import { cookies } from "next/headers";
import { requireUser, resolveSubject, visibleAthletes } from "./auth";

// Angemeldete Person + wessen Daten angezeigt werden (Admin/Coach können wechseln).
export async function viewerAndSubject() {
  const viewer = await requireUser();
  const jar = await cookies();
  const subject = await resolveSubject(viewer, jar.get("fs_subject")?.value);
  const athletes = await visibleAthletes(viewer);
  return { viewer, subject, athletes, own: subject.id === viewer.id };
}
