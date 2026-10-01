import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser, resolveSubject } from "@/lib/auth";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import * as repo from "@/lib/repo";
import { DEMO_USER } from "@/lib/demodata";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const u = new URL(req.url);
  let subject;
  if (u.searchParams.get("demo") === "1") subject = { ...DEMO_USER }; // öffentliche Demo, nur Beispieldaten
  else {
    const viewer = await currentUser();
    if (!viewer) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    subject = await resolveSubject(viewer, (await cookies()).get("fs_subject")?.value);
  }
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
    sleepScore: d.sleepScore, bbHigh: d.bbHigh, stress: d.stress, vo2max: d.vo2max, readiness: d.readiness, spo2: d.spo2, deep: d.deep, rem: d.rem,
    alc: (d.night || []).filter((t) => t.t === "alkohol").reduce((s, t) => s + (t.n || 1), 0),
  }));
  const inR = (d) => d >= from && d <= to;
  const [acts, daily, man, media] = await Promise.all([repo.getActivities(subject.id), repo.getDaily(subject.id), repo.getManual(subject.id), repo.getMedia(subject.id)]);
  const origin = { acts: acts.filter((a) => inR(a.day)).length, daily: daily.filter((d) => inR(d.day)).length, manual: man.filter((m) => inR(m.day)).length, media: media.filter((m) => inR(m.day)).length };
  const tests = man.filter((m) => m.kind === "test").sort((a, b) => (a.day < b.day ? -1 : 1)).map((m) => ({ day: m.day, value: m.value, test: m.data?.test }));
  return NextResponse.json({ from, to, today, prevFrom, days: slim, origin, zones, tests });
}
