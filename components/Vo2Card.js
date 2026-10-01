import Spark from "./Spark";
import { VO2_CLASSES } from "@/lib/vo2";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const sg = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}`;

// VO2max: Wert, Einordnung für Alter/Geschlecht, Fitnessalter, Verlauf 12 Monate
export default function Vo2Card({ v, compact = false }) {
  if (!v) return null;
  const pos = v.cls ? Math.min(100, Math.max(2, (v.score / 5) * 100)) : null;
  return (
    <div className={`vo2${compact ? " compact" : ""}`}>
      <div className="vo2-top">
        <div><span className="lbl">VO2max</span><b>{v.cur}<small className="note"> ml/kg/min</small></b><small className="note">{v.src === "Test" ? "Test" : "Uhr (Garmin über intervals.icu)"} · {fmt(v.day)}{v.stale ? " · älter als 30 Tage" : ""}</small></div>
        {v.cls && <div><span className="lbl">Für {v.sex === "w" ? "Frauen" : "Männer"} mit {v.age} J.</span><b className="vo2-cls">{v.cls.name}</b>{v.cls.next && <small className="note">«{v.cls.next.name}» ab {v.cls.next.at}</small>}</div>}
        {v.fitAge != null && <div><span className="lbl">Fitnessalter</span><b>{v.fitAge <= 20 ? "≤ 20" : `≈ ${v.fitAge}`}<small className="note"> J.</small></b><small className="note">{v.fitAge < v.age ? `${v.age - v.fitAge} Jahre jünger als du` : v.fitAge > v.age ? `${v.fitAge - v.age} Jahre älter als du` : "wie dein Alter"}</small></div>}
      </div>
      {pos != null && (
        <div className="vo2-scale" aria-hidden="true">
          {VO2_CLASSES.map((n) => <span key={n}>{n}</span>)}
          <i style={{ left: `${pos}%` }} />
        </div>
      )}
      {!compact && v.pts.length > 3 && <Spark pts={v.pts} tone={v.d90 > 0.5 ? "good" : v.d90 < -1 ? "warn" : ""} w={320} h={54} />}
      <p className="note">
        {[v.d90 != null && `${sg(v.d90)} in 3 Monaten`, v.d365 != null && `${sg(v.d365)} in 12 Monaten`, v.best && `Bestwert 12 Mon. ${v.best.v} (${fmt(v.best.day)})`].filter(Boolean).join(" · ")}
        {!v.age && " · Für Einordnung und Fitnessalter unter Konto den Jahrgang eintragen."}
        {v.sexAssumed && v.age ? " · Eingeordnet mit den Normen für Männer – unter Tests → Fitness-Profil ändern." : ""}
      </p>
      {!compact && <p className="note">Die Uhr schätzt VO2max aus Läufen und Fahrten mit Puls (Rad nur mit Wattmesser) – gut als Trend, ±3–5 gegenüber dem Labor. Normen angelehnt an das Cooper-Institut. Steigern: VO2max-Intervalle (z. B. Norwegian 4×4) 1× pro Woche, dazu viel lockere Grundlage.</p>}
    </div>
  );
}
