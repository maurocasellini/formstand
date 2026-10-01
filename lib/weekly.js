// Wochen- und Monatsrückblick: was war, wie gut lief der Plan, was kommt.
import { ACT_LABEL } from "./adherence";

const mean = (a) => { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; };
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export function periodReview(all, rows, from, to) {
  const days = all.filter((d) => d.day >= from && d.day <= to);
  const prevLen = days.length, prev = all.filter((d) => d.day < from).slice(-prevLen * 4);
  const hours = days.reduce((s, d) => s + (d.smin || 0), 0) / 60;
  const prevHours = prev.length ? (prev.reduce((s, d) => s + (d.smin || 0), 0) / 60) / (prev.length / prevLen) : null;
  const R = rows.filter((r) => r.day >= from && r.day <= to);
  const pts = R.reduce((s, r) => s + (r.status === "gefolgt" ? 1 : r.status === "teilweise" ? 0.5 : 0), 0);
  const kinds = {};
  for (const r of R) kinds[r.act.kind] = (kinds[r.act.kind] || 0) + 1;
  const focus = R.filter((r) => (r.rec.focus || r.rec.focus2) && r.status === "gefolgt").length, focusPlan = R.filter((r) => r.rec.focus || r.rec.focus2).length;
  const alc = days.reduce((s, d) => s + (d.triggers || []).filter((t) => t.t === "alkohol").length, 0);
  const w = days.map((d) => d.weight).filter((v) => v != null);
  const best = [...days].filter((d) => d.score != null).sort((a, b) => b.score - a.score)[0];
  return {
    from, to, hours: r1(hours), prevHours: r1(prevHours), sessions: days.reduce((s, d) => s + (d.sessions || 0), 0),
    quality: days.filter((d) => (d.hardSessions || []).some((h) => h.category === "end")).length, strength: days.filter((d) => d.str > 0).length,
    adherence: R.length ? Math.round((pts / R.length) * 100) : null, focus, focusPlan, kinds,
    score: r1(mean(days.map((d) => d.score))), hrv: r1(mean(days.map((d) => d.hrv))), sleep: r1(mean(days.map((d) => d.sleep))),
    alc, weightDelta: w.length >= 2 ? r1(w[w.length - 1] - w[0]) : null, best: best ? { day: best.day, score: best.score } : null,
    off: R.filter((r) => r.status === "anders").map((r) => ({ day: r.day, rec: r.rec.title, did: ACT_LABEL[r.act.kind] })),
  };
}

export function reviewText(p, label) {
  const parts = [`${p.hours} h, ${p.sessions} Einheiten`];
  if (p.adherence != null) parts.push(`Plan-Treue ${p.adherence} %`);
  if (p.focusPlan) parts.push(`${p.focus}/${p.focusPlan} Fokus-Einheiten`);
  if (p.score != null) parts.push(`Ø Bereitschaft ${Math.round(p.score)}`);
  return `${label}: ${parts.join(" · ")}`;
}
