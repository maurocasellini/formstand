import ActionForm from "./ActionForm";
import CoachReply from "./CoachReply";

const fmtD = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const sg = (v, d = 0) => (v == null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`);
const vs = (a, b, d = 0, unit = "") => (a == null || b == null ? null : `${sg(a - b, d)}${unit} zu vorher`);

// Ein Zeitraum: Urteil, Kennzahlen gegen vorher, gut / verbessern, nächster Schritt, optional KI-Feedback
export default function Feedback({ f, ai, aiOn, ro, action, reply }) {
  const k = f.k;
  const kpis = [
    ["Training", k.hours != null ? `${k.hours} h` : "–", vs(k.hours, k.hoursPrev, 1, " h"), `${k.sessions} Einheiten · ${k.quality} hart · ${k.strength} Kraft`],
    ["Plan-Treue", k.adherence != null ? `${k.adherence} %` : "–", k.focusPlan ? `${k.focus}/${k.focusPlan} Fokus-Einheiten` : null],
    ["Ø Bereitschaft", k.score != null ? Math.round(k.score) : "–", vs(k.score, k.scorePrev)],
    ["Ø HRV", k.hrv != null ? `${Math.round(k.hrv)} ms` : "–", k.hrv != null && k.hrvPrev ? `${sg(((k.hrv / k.hrvPrev) - 1) * 100)} % zu vorher` : null],
    ["Ø Ruhepuls", k.rhr != null ? `${Math.round(k.rhr)} bpm` : "–", vs(k.rhr, k.rhrPrev, 1)],
    ["Ø Schlaf", k.sleep != null ? `${k.sleep} h` : "–", k.sleep != null && k.sleepPrev != null ? `${sg((k.sleep - k.sleepPrev) * 60)} min zu vorher` : null],
    ["Fitness (CTL)", k.ctl ?? "–", k.ctlDelta != null ? `${sg(k.ctlDelta)} im Zeitraum` : null],
    (k.alc > 0 || k.alcPrev > 0) && ["Alkohol", `${k.alc} Abende`, k.alcPrev != null ? `vorher ${k.alcPrev}` : null],
    k.kcalIn != null && ["Ø gegessen", `${k.kcalIn.toLocaleString("de-CH")} kcal`, k.proteinIn ? `${k.proteinIn} g Protein` : null, `${k.foodDays} Tage erfasst`],
    k.weightDelta != null && ["Gewicht", `${sg(k.weightDelta, 1)} kg`, "im Zeitraum"],
  ].filter(Boolean)
    // ohne Daten: ausblenden – Schlaf bleibt sichtbar, aber ausgegraut
    .filter(([l, v]) => v !== "–" || l === "Ø Schlaf");
  return (
    <div className="fb">
      <div className={`fb-head ${f.tone}`}><b>{f.headline}</b><span className="note">{fmtD(f.from)}–{fmtD(f.to)}{f.running ? " · Zwischenstand" : ""}</span></div>
      <div className="fb-kpis">{kpis.map(([l, v, d, x]) => v === "–" ? <div key={l} className="nodata"><span>{l}</span><b>keine Daten</b><small>Uhr nachts tragen</small></div> : <div key={l}><span>{l}</span><b>{v}</b>{d && <small>{d}</small>}{x && <small>{x}</small>}</div>)}</div>
      <div className="fb-cols">
        <div className="ba-list good"><span className="lbl">Das lief gut</span>{f.good.length ? <ul>{f.good.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="note">Noch nichts Auffälliges.</p>}</div>
        <div className="ba-list warn"><span className="lbl">Daran arbeiten</span>{f.work.length ? <ul>{f.work.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="note">Nichts Dringendes.</p>}</div>
      </div>
      {f.next && <p className="fb-next"><b>Nächster Schritt:</b> {f.next}</p>}
      {ai && (
        <div className="fb-ai">
          <span className="lbl">Coach-Feedback der KI</span>
          <b>{ai.titel}</b><p>{ai.fazit}</p>
          {ai.gut?.length > 0 && <ul>{ai.gut.map((x) => <li key={x}>✓ {x}</li>)}</ul>}
          {ai.besser?.length > 0 && <ul>{ai.besser.map((x) => <li key={x}>→ {x}</li>)}</ul>}
          {ai.fokus && <p><b>Fokus:</b> {ai.fokus}</p>}
          <small className="note">geschrieben {new Date(ai.created_at).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" })}</small>
        </div>
      )}
      <div className="btnrow">
        {aiOn && !ro && <ActionForm action={action} className="btnrow" submit={ai ? "KI-Feedback aktualisieren" : "Persönliches KI-Feedback"} busy="Schreibt… (ca. 10 s)" reset={false}><input type="hidden" name="period" value={f.key} /></ActionForm>}
        {aiOn && !ro && ai && reply && <CoachReply action={reply} ctx="feedback" period={f.key} planDefault={false} placeholder="z. B. Die Woche war wegen Reise kurz – nächste Woche habe ich wieder normal Zeit." />}
      </div>
    </div>
  );
}
