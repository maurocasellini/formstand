import Link from "next/link";
import ConfirmDelete from "./ConfirmDelete";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const left = (d) => (d == null ? "" : d < 0 ? `seit ${-d} Tagen vorbei` : d === 0 ? "heute" : d < 60 ? `noch ${d} Tage` : `noch ${Math.round(d / 7)} Wochen`);

// Fortschritt messbarer Ziele: Balken = erreicht, Strich = wo du nach der Zeit stehen solltest
export default function Targets({ list, del, ro, compact = false, base = "" }) {
  if (!list?.length) return null;
  return (
    <div className={`tgts${compact ? " compact" : ""}`}>
      {list.map((t) => (
        <div key={t.id} className={`tgt ${t.tone || ""}`}>
          <div className="tgt-h"><b>{t.name}</b><span className={`tag ${t.tone === "good" ? "on" : t.tone === "warn" ? "wait" : t.tone === "crit" ? "crit" : ""}`}>{t.status}</span></div>
          {t.free ? (
            <p className="note">bis {fmt(t.by)} · {left(t.daysLeft)}{t.note ? ` · ${t.note}` : ""}</p>
          ) : (<>
            <div className="tgt-v"><span>{t.startTxt}</span><b>{t.curTxt}</b><span>Ziel {t.targetTxt}</span></div>
            <div className="tgt-bar" title={`${t.progressPct} % geschafft, ${t.timePct} % der Zeit vorbei`}><i style={{ width: `${Math.max(2, t.progressPct)}%` }} /><em style={{ left: `${t.timePct}%` }} /></div>
            <p className="note">{t.progressPct} % geschafft · {t.timePct} % der Zeit · bis {fmt(t.by)} ({left(t.daysLeft)}){t.perWeekTxt && t.status !== "erreicht" ? ` · nötig: ${t.perWeekTxt}` : ""}{t.stale && t.status !== "erreicht" ? (t.metric.startsWith("t:") || t.metric === "ftp" ? " · neuer Test fällig" : " · neue Messung fällig") : ""}</p>
            {!compact && t.note && <p className="note">{t.note}</p>}
          </>)}
          {!compact && !ro && del && <ConfirmDelete action={del} value={t.id} label="Ziel löschen" ask="Ziel löschen?" />}
        </div>
      ))}
      {compact && <Link className="note" href={`${base}/ziele#meineziele`}>Ziele bearbeiten →</Link>}
    </div>
  );
}
