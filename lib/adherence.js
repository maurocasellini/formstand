// Hat die Empfehlung funktioniert? Für vergangene Tage wird die Entscheidung mit dem Wissensstand
// jenes Morgens rekonstruiert, mit dem tatsächlichen Training verglichen und mit dem Folgemorgen bewertet.
import { computeStates } from "./state";
import { decide } from "./decide";
import { planFor, phaseFor } from "./plan";

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export const ACT_LABEL = { none: "kein Training", quality: "harte Einheit", strength: "Krafttraining", mixed: "Ausdauer + Kraft", endurance: "Ausdauer locker/mittel" };

export function actualOf(d) {
  if (!d) return null;
  const hard = (d.hardSessions || []).some((h) => h.category === "end");
  const kind = !d.sessions ? "none" : hard ? "quality" : d.str > 0 && d.end === 0 ? "strength" : d.str > 0 ? "mixed" : "endurance";
  return { kind, min: Math.round(d.smin || 0), names: (d.hardSessions || []).map((h) => h.name) };
}

export function match(rec, act) {
  const t = rec.type, k = act.kind;
  if (t === "race") return k !== "none" ? "gefolgt" : "ausgelassen";
  if (t === "rest" || t === "recovery") return k === "none" || (k === "endurance" && act.min <= 60) ? "gefolgt" : k === "quality" ? "anders" : "teilweise";
  if (t === "quality") return k === "quality" ? "gefolgt" : k === "none" ? "ausgelassen" : "teilweise";
  if (t === "strength") return k === "strength" || k === "mixed" ? "gefolgt" : k === "none" ? "ausgelassen" : "teilweise";
  return k === "endurance" || k === "mixed" ? "gefolgt" : k === "quality" ? "anders" : k === "none" ? "ausgelassen" : "teilweise";
}

export function decisionAt(all, i, ctx) {
  const sub = all.slice(0, i + 1), day = all[i].day;
  const goals = ctx.goals;
  return decide({ all: sub, st: computeStates(sub), zones: ctx.zones, profile: ctx.profile, triggers: ctx.triggers || [], planned: goals ? planFor(goals, day, ctx.profile, ctx.zones) : null, phase: goals ? phaseFor(goals, day) : null });
}

export function review(all, ctx, days = 28) {
  const out = [], n = all.length;
  for (let i = Math.max(35, n - 1 - days); i < n - 1; i++) {
    const rec = decisionAt(all, i, ctx);
    if (!rec) continue;
    const act = actualOf(all[i]);
    out.push({ day: all[i].day, rec: { type: rec.type, title: rec.title.replace(/^Heute: /, ""), focus: rec.planned?.focus || null, focus2: rec.planned?.focus2 || null }, act, status: match(rec, act), scoreToday: all[i].score, scoreNext: all[i + 1]?.score ?? null });
  }
  return out;
}

const count = (rows) => { const m = {}; for (const r of rows) for (const f of [r.rec.focus, r.rec.focus2]) if (f) m[f] = (m[f] || 0) + 1; return m; };
export function summarize(rows) {
  const pts = rows.reduce((s, r) => s + (r.status === "gefolgt" ? 1 : r.status === "teilweise" ? 0.5 : 0), 0);
  const fol = rows.filter((r) => r.status === "gefolgt" && r.scoreNext != null).map((r) => r.scoreNext);
  const oth = rows.filter((r) => r.status !== "gefolgt" && r.scoreNext != null).map((r) => r.scoreNext);
  const harder = rows.filter((r) => r.status === "anders" && r.scoreNext != null && r.scoreToday != null).map((r) => r.scoreNext - r.scoreToday);
  return {
    adherence: rows.length ? Math.round((pts / rows.length) * 100) : null, n: rows.length,
    followedNext: fol.length >= 4 && oth.length >= 4 ? mean(fol) : null, otherNext: fol.length >= 4 && oth.length >= 4 ? mean(oth) : null, nF: fol.length, nO: oth.length,
    harderDelta: harder.length >= 3 ? mean(harder) : null, nH: harder.length,
    focusDone: count(rows.filter((r) => r.status === "gefolgt")),
    focusPlanned: count(rows),
  };
}
