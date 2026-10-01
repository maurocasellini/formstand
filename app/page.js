import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { hasDb, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasDb) redirect("/setup");
  const u = await currentUser();
  if (u) redirect("/heute");
  const c = await one("select count(*)::int as n from users");
  redirect(c.n === 0 ? "/setup" : "/login");
}
