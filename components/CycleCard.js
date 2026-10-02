import ActionForm from "./ActionForm";
import { PHASES, SYMPTOMS, phaseOf } from "@/lib/cycle";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const COL = { mens: "var(--crit)", foll: "var(--accent)", ov: "var(--good)", lut: "var(--warn)", late: "#8b5cf6" };

// Zyklus auf einen Blick: Tag, Phase, Balken über den Zyklus, Prognose, Hinweise, Eintragen
export default function CycleCard({ c, today, addPeriod, saveSymptoms, own }) {
  const has = c?.day != null;
  const segs = has && c.mode === "natural" ? Array.from({ length: c.len }, (_, i) => phaseOf(i + 1, c.len, c.pl)) : [];
  const p = c?.phase ? PHASES[c.phase] : null, me = c?.personal?.[c?.phase];
  return (
    <div className="cyc">
      {has ? (<>
        <div className="cyc-h">
          <div><span className="lbl">Zyklustag</span><b>{c.day}</b>{c.late && <small className="note"> · Periode überfällig</small>}</div>
          {p && <div><span className="lbl">Phase</span><b style={{ color: COL[c.phase] }}>{p[0]}</b></div>}
          {c.daysToNext != null && <div><span className="lbl">Nächste Periode</span><b>{c.daysToNext > 0 ? `in ~${c.daysToNext} T.` : c.daysToNext === 0 ? "heute erwartet" : "überfällig"}</b><small className="note">{fmt(c.nextStart)} · Zyklus Ø {c.len} T.</small></div>}
        </div>
        {segs.length > 0 && (
          <div className="cyc-bar" aria-hidden="true">
            {segs.map((s, i) => <i key={i} style={{ background: COL[s], opacity: i + 1 === c.day ? 1 : 0.35 }} />)}
            <em style={{ left: `${(Math.min(c.day, c.len) - 0.5) / c.len * 100}%` }} />
          </div>
        )}
        {segs.length > 0 && <div className="cyc-legend">{Object.entries(PHASES).map(([k, [n]]) => <span key={k}><i style={{ background: COL[k] }} />{n}</span>)}</div>}
        {p && <p>{p[1]}</p>}
        {c.tips && <ul className="cyc-tips"><li><b>Training:</b> {c.tips.training}</li><li><b>Ernährung:</b> {c.tips.food}</li><li><b>Erholung:</b> {c.tips.recovery}</li></ul>}
        {me && (me.hrvPct != null || me.rhr != null) && <p className="note"><b>Bei dir in dieser Phase</b> (aus {c.starts.length - 1} Zyklen): {[me.hrvPct != null && `HRV ${me.hrvPct > 0 ? "+" : ""}${me.hrvPct} %`, me.rhr != null && `Ruhepuls ${me.rhr > 0 ? "+" : ""}${me.rhr} bpm`, me.score != null && `Bereitschaft ${me.score > 0 ? "+" : ""}${me.score}`].filter(Boolean).join(" · ")} gegenüber deinem Zyklusschnitt.</p>}
        {!c.personal && c.mode === "natural" && <p className="note">Nach 2 vollständigen Zyklen zeigt Formstand, wie deine HRV und dein Ruhepuls je Phase reagieren.</p>}
      </>) : <p className="muted">Trag den Beginn deiner letzten Periode ein – dann rechnet Formstand Zyklustag, Phase und Prognose.</p>}
      {own && (
        <div className="cyc-act">
          <ActionForm action={addPeriod} className="btnrow" submit="Periode hat heute begonnen" busy="Speichert…" reset={false}><input type="hidden" name="day" value={today} /></ActionForm>
          <details><summary className="note" style={{ cursor: "pointer" }}>Symptome heute{c?.symptomsToday?.length ? ` (${c.symptomsToday.length})` : ""}</summary>
            <ActionForm action={saveSymptoms} className="stack" submit="Speichern" reset={false}>
              <input type="hidden" name="day" value={today} />
              <div className="chips">{SYMPTOMS.map(([k, n]) => <label key={k}><input type="checkbox" name="s" value={k} defaultChecked={c?.symptomsToday?.includes(k)} /><span>{n}</span></label>)}</div>
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}
