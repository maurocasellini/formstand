import Link from "next/link";
import Dashboard from "@/components/Dashboard";
import { pageContext } from "@/lib/subject";
import { todayModel } from "@/lib/coach";
import { changes } from "@/lib/insights";
import { review, summarize } from "@/lib/adherence";
import { triggerLine, analyzePairs, pairLine } from "@/lib/triggers";
import { learnedText } from "@/lib/learn";
import * as repo from "@/lib/repo";

export const maxDuration = 60;

const arrow = (c) => (c.val == null ? "★" : c.sig ? (c.val > 0 ? "↑" : "↓") : "→");
const tone = (c) => (!c.sig ? "flat" : c.warn ? "bad" : c.dir === 0 || c.val == null ? "neutral" : c.dir * c.val > 0 ? "good" : "bad");

export default async function Entwicklung({ demo } = {}) {
  const { subject, base } = await pageContext(demo);
  const m = await todayModel(subject.id);
  const manual = await repo.getManual(subject.id);
  const ch = changes(m.all, { focus: m.goals.focus, manual });
  // Kernaussagen in fester Reihenfolge: Leistung, Fitness, Körper, Erholung, dann Belastung
  const ORDER = ["ftp", "ctl", "vo2max", "bodyfat", "smm", "weight", "sleep", "hrv", "rhr", "score", "end", "str", "hours"];
  const byKey = Object.fromEntries(ch.map((c) => [c.key, c]));
  const head = ORDER.map((k) => byKey[k]).filter(Boolean);
  const pairs = analyzePairs(m.all, m.activities).filter((p) => p.stronger).slice(0, 2);
  const sum = summarize(review(m.all, { ...m.ctx, goals: m.hasGoals ? m.goals : null }, 28));
  const trig = m.triggers.filter((t) => t.level === "ziemlich sicher" || t.level === "Tendenz").slice(0, 3).map(triggerLine).filter(Boolean);

  return (
    <>
      <div className="head">
        <div style={{ display: "grid", gap: 4 }}>
          <h1>Entwicklung</h1>
          <p>Erst die Erkenntnisse, dann die Daten. Verglichen wird immer mit dir selbst.</p>
        </div>
        {m.phase?.event && m.phase.daysTo > 0 && <Link href={`${base}/ziele`} className="phasebox"><span className="tag on">{m.phase.label}</span><b>{m.phase.daysTo} Tage bis {m.phase.event.name}</b></Link>}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Was hat sich verändert?</h2><span className="note">letzte 30 Tage gegen die 30 Tage vor 90 Tagen · „unverändert“ = innerhalb deines normalen Schwankens</span></div>
        {head.length ? (
          <div className="ins">{head.map((c) => (
            <div key={c.key} className={`insc ${tone(c)}`}>
              <span className="ar">{c.warn ? "⚠" : arrow(c)}</span>
              <div><b>{c.label}</b>
                {c.sig ? (c.val != null ? <span className="v">{c.val > 0 ? "+" : "−"}{Math.abs(c.val).toFixed(c.dec ?? 1)}{c.unit}</span> : <span className="v sm">neu</span>) : <span className="v sm">unverändert</span>}
                <small>{c.text || c.extra || (c.now != null ? `jetzt ${c.now.toFixed(c.dec ?? 1)}${c.unit === " %" ? "" : c.unit || ""}, vorher ${c.before.toFixed(c.dec ?? 1)}${c.unit === " %" ? "" : c.unit || ""}` : "")}</small></div>
            </div>
          ))}</div>
        ) : <div className="empty">Für Trends braucht es gut 4 Monate Daten.</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Was Formstand über dich gelernt hat</h2><span className="note">Zusammenhänge in deinen Daten, keine Beweise</span></div>
        <ul className="learnl">
          <li><b>Belastbarkeit:</b> {learnedText(m.learned)}</li>
          {sum.adherence != null && <li><b>Plan-Treue 4 Wochen: {sum.adherence} %</b>{sum.followedNext != null ? ` – wenn du der Empfehlung gefolgt bist, war die Bereitschaft am Folgetag im Schnitt ${Math.abs(Math.round(sum.followedNext - sum.otherNext))} ${Math.abs(Math.round(sum.followedNext - sum.otherNext)) === 1 ? "Punkt" : "Punkte"} ${sum.followedNext >= sum.otherNext ? "höher" : "tiefer"}.` : "."} <Link href={`${base}/ziele`}>Details</Link></li>}
          {trig.map((t) => <li key={t}>{t}</li>)}
          {pairs.map((p) => <li key={p.a + p.b}>{pairLine(p)}</li>)}
          {!trig.length && <li className="muted">Trage Abend-Faktoren (Alkohol, spätes Essen, Mobility …) ein – nach einigen Wochen siehst du hier deine Reaktion darauf.</li>}
        </ul>
      </section>

      <details className="panel more-data">
        <summary><h2>Daten & Verlauf</h2><span className="note">Kennzahlen, Charts und Rohdaten zum Nachschauen</span></summary>
        <Dashboard demo={Boolean(demo)} />
      </details>
    </>
  );
}
