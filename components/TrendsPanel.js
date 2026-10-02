import Tabs from "./Tabs";
import TrendChart from "./TrendChart";
import { LoadChart, WeeksChart } from "./TrainingChart";

const dmy = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(2, 4)}`;

function MetricCard({ x, coach }) {
  const f = (v) => (v == null ? "–" : v.toFixed(x.dec));
  return (
    <div className="tr-card">
      <div className="tr-h"><b>{x.label}</b><span className={`tr-chip ${x.tone}`}>{x.trend}{x.delta ? ` · ${x.delta}` : ""}</span></div>
      <div className="tr-cur">{f(x.cur)}<small>{x.unit}</small></div>
      <TrendChart sparse={x.sparse} days={x.days} vals={x.vals} roll={x.roll} m={x.m} s={x.s} unit={x.unit} dec={x.dec} tone={x.tone} label={x.label} />
      <div className="tr-stats">
        <div><span>{x.sparse ? "Ø 3 Messungen" : "Ø 7 Tage"}</span><b>{f(x.avg7)}</b></div>
        <div><span>Ø Zeitraum</span><b>{f(x.m)}</b></div>
        <div><span>Spanne</span><b>{f(x.min)}–{f(x.max)}</b></div>
        <div><span>{x.dir === 0 ? "Messtage" : "Bestwert"}</span><b>{x.dir === 0 || !x.best ? x.n : `${f(x.best.v)}`}</b>{x.dir !== 0 && x.best && <span>{dmy(x.best.day)}</span>}</div>
      </div>
      {coach ? <p className="tr-coach"><b>Coach:</b> {coach}</p> : <p className="note">{x.about}</p>}
    </div>
  );
}

// Trends: Zeiträume als Reiter, je Gruppe Karten mit Verlauf, Kennzahlen und Erklärung (KI, wöchentlich)
export default function TrendsPanel({ td, ai }) {
  const ranges = Object.values(td);
  if (!ranges.length) return null;
  const m = ai?.metriken || {};
  return (
    <div className="stack">
      {ai?.fazit ? <div className="tr-ai"><span className="lbl">Was deine Trends erzählen · Coach-Einschätzung vom Montag</span><p>{ai.fazit}</p></div>
        : <p className="note">Die Coach-Erklärung zu deinen Trends kommt mit dem nächsten Wochenbrief (montags) – oder oben beim Wochenbrief «Jetzt neu schreiben».</p>}
      <Tabs labels={ranges.map((r) => r.label)} start={0}>
        {ranges.map((R) => {
          const groups = [...new Set(R.metrics.map((x) => x.group))];
          return (
            <div key={R.key} className="stack">
              {groups.map((g) => (
                <div key={g} className="tr-group">
                  <h3>{g}</h3>
                  <div className="tr-grid">{R.metrics.filter((x) => x.group === g).map((x) => <MetricCard key={x.key} x={x} coach={m[x.label]} />)}</div>
                  {g === "Erholung" && R.training && (
                    <>
                      <h3>Training</h3>
                      <div className="tr-grid">
                        <div className="tr-card">
                          <div className="tr-h"><b>Fitness & Ermüdung</b><span className={`tr-chip ${R.training.ctlChange > 2 ? "good" : R.training.ctlChange < -3 ? "warn" : ""}`}>Fitness {R.training.ctlChange >= 0 ? "+" : "−"}{Math.abs(R.training.ctlChange).toFixed(0)}</span></div>
                          <div className="tr-cur">{Math.round(R.training.ctlNow)}<small>CTL · Form {Math.round(R.training.tsbNow)}</small></div>
                          <LoadChart days={R.training.days} ctl={R.training.ctl} atl={R.training.atl} tsb={R.training.tsb} />
                          <div className="tr-legend"><span><i style={{ background: "var(--ch-1)" }} />Fitness (CTL, 6 Wochen)</span><span><i style={{ background: "var(--ch-2)" }} />Ermüdung (ATL, 7 Tage)</span></div>
                          {m.Training ? <p className="tr-coach"><b>Coach:</b> {m.Training}</p> : <p className="note">Liegt die Ermüdung länger über der Fitness, baust du auf – bleibt sie zu lange darüber, droht Überlastung. Form = Fitness − Ermüdung.</p>}
                        </div>
                        <div className="tr-card">
                          <div className="tr-h"><b>Stunden pro Woche</b><span className="tr-chip">Ø {R.training.avgHours != null ? R.training.avgHours.toFixed(1) : "–"} h</span></div>
                          <WeeksChart weeks={R.training.weeks} />
                          <div className="tr-legend"><span><i style={{ background: "var(--ch-1)" }} />Ausdauer</span><span><i style={{ background: "var(--ch-2)" }} />Kraft</span></div>
                          <p className="note">{R.training.text}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </Tabs>
    </div>
  );
}
