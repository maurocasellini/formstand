import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser, resolveSubject } from "@/lib/auth";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const subject = await resolveSubject(viewer, (await cookies()).get("fs_subject")?.value);
  const u = new URL(req.url);
  const today = todayIso();
  let to = u.searchParams.get("to") || today, from = u.searchParams.get("from") || addDays(today, -364);
  if (from > to) [from, to] = [to, from];
  const len = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
  if (len > 1100) return NextResponse.json({ error: "Zeitraum zu lang (max. 3 Jahre)" }, { status: 400 });
  const prevFrom = addDays(from, -len);
  const heatFrom = addDays(today, -364);
  const start = [prevFrom, heatFrom].sort()[0];
  const { all, zones } = await buildSeries(subject.id, start, to > today ? to : today);
  const slim = all.filter((d) => d.day >= start).map((d) => ({
    day: d.day, end: Math.round(d.end), str: Math.round(d.str), other: Math.round(d.other), min: d.min, n: d.n,
    low: Math.round(d.low), mid: Math.round(d.mid), high: Math.round(d.high),
    ctl: Math.round(d.ctl * 10) / 10, score: d.score, hrv: d.hrv, rhr: d.rhr, sleep: d.sleep, weight: d.weight,
    alc: (d.night || []).filter((t) => t.t === "alkohol").reduce((s, t) => s + (t.n || 1), 0),
  }));
  const [origin] = await q(
    `select (select count(*) from raw_events where user_id=$1 and fetched_at::date between $2 and $3)::int as api,
            (select count(*) from activities where user_id=$1 and day between $2 and $3)::int as acts,
            (select count(*) from daily_metrics where user_id=$1 and day between $2 and $3)::int as daily,
            (select count(*) from manual_entries where user_id=$1 and day between $2 and $3)::int as manual,
            (select count(*) from media where user_id=$1 and day between $2 and $3)::int as media`, [subject.id, from, to]);
  const tests = await q(`select day::text as day, value, data->>'test' as test from manual_entries where user_id=$1 and kind='test' order by day`, [subject.id]);
  return NextResponse.json({ from, to, today, prevFrom, days: slim, origin, zones, tests });
}
