import Link from "next/link";
import Dashboard from "@/components/Dashboard";
import { viewerAndSubject } from "@/lib/subject";
import { todayModel } from "@/lib/coach";
import { changes } from "@/lib/insights";
import { review, summarize } from "@/lib/adherence";
import { triggerLine } from "@/lib/triggers";
import * as repo from "@/lib/repo";

export const maxDuration = 60;

const arrow = (c) => (c.val == null ? "★" : c.sig ? (c.val > 0 ? "↑" : "↓") : "→");
const tone = (c) => (!c.sig ? "flat" : c.warn ? "bad" : c.dir === 0 || c.val == null ? "neutral" : c.dir * c.val > 0 ? "good" : "bad");

export default async function Entwicklung() {
  const { subject } = await viewerAndSubject();
  const m = await todayModel(subject.id);
  const manual = await repo.getManual(subject.id);
  const ch = changes(m.all, { focus: m.goals.focus, manual });
  const sig = ch.filter((c) => c.sig), flat = ch.filter((c) => !c.sig);
  const sum = summarize(review(m.all, { ...m.ctx, goals: m.hasGoals ? m.goals : null }, 28));
  const trig = m.triggers.filter((t) => t.level === "ziemlich sicher").slice(0, 2).map(triggerLine).filter(Boolean);

  return (
    <>
      <div className="head">
        <div style={{ display: "grid", gap: 4 }}>
          <h1>Entwicklung</h1>
          <p>Erst die Erkenntnisse, dann die Daten. Verglichen wird immer mit dir selbst.</p>
        </div>
        {m.phase?.event && m.phase.daysTo > 0 && <Link href="/ziele" className="phasebox"><span className="tag on">{m.phase.label}</span><b>{m.phase.daysTo} Tage bis {m.phase.event.name}</b></Link>}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Was hat sich verändert?</h2><span className="note">letzte 30 Tage gegen die 30 Tage vor 90 Tagen · nur Veränderungen über deinem normalen Schwanken</span></div>
        {ch.length ? (
          <>
            <div className="ins">{sig.map((c) => (
              <div key={c.key} className={`insc ${tone(c)}`}>
                <span className="ar">{c.warn ? "⚠" : arrow(c)}</span>
                <div><b>{c.label}</b>{c.val != null && <span className="v">{c.val > 0 ? "+" : ""}{c.val.toFixed(c.dec ?? 1)}{c.unit}</span>}
                  <small>{c.text || c.extra || (c.now != null ? `jetzt ${c.now.toFixed(c.dec ?? 1)}, vorher ${c.before.toFixed(c.dec ?? 1)}` : "")}</small></div>
              </div>
            ))}</div>
            {!sig.length && <p className="muted">Keine Veränderung, die über dein normales Schwanken hinausgeht.</p>}
            {flat.length > 0 && <p className="note">→ Unverändert (im Rahmen): {flat.map((c) => c.label).join(", ")}</p>}
          </>
        ) : <div className="empty">Für Trends braucht es gut 4 Monate Daten.</div>}
        {(sum.adherence != null || trig.length > 0) && (
          <div className="learn">
            {sum.adherence != null && <p><b>Plan-Treue 4 Wochen: {sum.adherence} %</b>{sum.followedNext != null ? ` · Wenn du der Empfehlung gefolgt bist, war die Tagesform am Folgetag im Schnitt ${Math.abs(Math.round(sum.followedNext - sum.otherNext))} ${Math.abs(Math.round(sum.followedNext - sum.otherNext)) === 1 ? "Punkt" : "Punkte"} ${sum.followedNext >= sum.otherNext ? "höher" : "tiefer"}.` : ""} <Link href="/ziele">Details</Link></p>}
            {trig.map((t) => <p key={t}>{t}</p>)}
          </div>
        )}
      </section>

      <Dashboard />
    </>
  );
}
