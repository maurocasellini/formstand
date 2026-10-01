import Link from "next/link";
import { viewerAndSubject } from "@/lib/subject";
import { buildSeries, todayIso, addDays, stateOf, stateText } from "@/lib/metrics";
import * as repo from "@/lib/repo";
import { TRIGGERS, triggerName } from "@/lib/catalog";
import { addManual, deleteManual, loadDemo, createAdvice } from "../../actions-data";
import { aiReady } from "@/lib/ai";
import { getTodayAdvice } from "@/lib/coach";
import ActionForm from "@/components/ActionForm";

const PNAME = { intervals: "intervals.icu", whoop: "WHOOP", garmin: "Garmin", oura: "Oura", apple: "Apple", demo: "Beispiel", strava: "Strava", zwift: "Zwift" };
const r1 = (v) => (v == null ? "–" : (Math.round(v * 10) / 10).toFixed(1));
const r0 = (v) => (v == null ? "–" : Math.round(v));

function Dial({ s, delta }) {
  const R = 72, C = 2 * Math.PI * R, st = stateOf(s);
  return (
    <div className="dial">
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" r={R} fill="none" stroke="var(--sunk)" strokeWidth="14" />
        {s != null && <circle cx="84" cy="84" r={R} fill="none" stroke={`var(--${st})`} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * s) / 100} ${C}`} transform="rotate(-90 84 84)" />}
      </svg>
      <div className="val"><div><b>{s ?? "–"}</b><small>{delta == null ? "von 100" : `${delta >= 0 ? "+" : ""}${delta} zu gestern`}</small></div></div>
    </div>
  );
}

function recommend(T, zones, sport) {
  if (T?.score == null) return "Sobald Recovery-Daten da sind (WHOOP, Garmin, Oura), steht hier die Tagesempfehlung.";
  const s = T.score, st = stateOf(s), F = zones.ftp;
  const w = (a, b) => (F ? ` (${Math.round(F * a)}–${Math.round(F * b)} W)` : "");
  const plan = {
    good: `Qualitätstag: 3×10 min Sweet Spot${w(0.88, 0.93)} oder Intervalle im Laufen. Krafttraining schwer möglich.`,
    warn: `Moderat: 60–75 min Zone 2${w(0.56, 0.75)}. Kraft nur mittel (RPE 7).`,
    crit: `Erholung: Ruhetag oder 30 min Zone 1${F ? ` (unter ${Math.round(F * 0.55)} W)` : ""}, Mobility.`,
  }[st];
  const alc = (T.night || []).find((t) => t.t === "alkohol");
  return [
    `Tagesform ${s}/100 · ${stateText(s)}`, "",
    `Training: ${plan}`,
    `Erholung: ${T.sleep != null ? `Schlaf ${r1(T.sleep)} h. ${T.sleep < 7 ? "Heute 30 min früher ins Bett." : "Rhythmus halten."}` : "Keine Schlafdaten."}`,
    alc ? `Hinweis: Alkohol am Vorabend (${alc.n} Gl.) drückt HRV und Ruhepuls.` : null,
    T.tsb < -20 ? `Achtung: Ermüdung deutlich über Fitness (Form ${Math.round(T.tsb)}). Entlastung einplanen.` : null,
  ].filter((x) => x !== null).join("\n");
}

export const maxDuration = 60;

function Advice({ a }) {
  const t = new Date(a.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
  return (
    <div className="adv">
      <div className="adv-head"><span className={`pill ${a.state}`}>{a.headline}</span></div>
      {a.summary && <p className="adv-sum">{a.summary}</p>}
      <dl>
        {[["Training", a.training], ["Alternative", a.alternative], ["Erholung", a.recovery], ["Ernährung", a.nutrition]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {a.watch?.length > 0 && <ul className="adv-watch">{a.watch.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {a.why?.length > 0 && <details><summary>Warum?</summary><ul>{a.why.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
      <p className="note">Erstellt um {t} aus deinen Daten. Ersetzt keine ärztliche Beratung.</p>
    </div>
  );
}

export default async function Heute() {
  const { subject } = await viewerAndSubject();
  const today = todayIso();
  const { days, activities, providers, zones } = await buildSeries(subject.id, addDays(today, -41), today);
  const T = days[days.length - 1], Y = days[days.length - 2];
  const conns = await repo.getConnections(subject.id);
  const todayTrig = (await repo.getManual(subject.id)).filter((e) => e.kind === "trigger" && e.day === today);
  const hasAny = activities.length || providers.length;
  const recP = Object.keys(T?.prov || {});
  const [ai, advice] = await Promise.all([aiReady(), getTodayAdvice(subject.id)]);
  const labels = { hrv: "HRV", rhr: "Ruhepuls", sleep: "Schlaf", tsb: "Trainingsbalance" };

  // Mini-Verlauf 6 Wochen
  const W = 560, H = 200, L = 30, Rr = 10, Tp = 10, B = 22;
  const maxL = Math.max(60, ...days.map((d) => d.load));
  const x = (i) => L + (i * (W - L - Rr)) / (days.length - 1), yS = (v) => Tp + ((100 - v) * (H - Tp - B)) / 100, yL = (v) => H - B - (v / maxL) * (H - Tp - B) * 0.6;
  const pts = days.map((d, i) => (d.score == null ? null : [x(i), yS(d.score)]));
  let path = "", started = false;
  pts.forEach((p) => { if (!p) { started = false; return; } path += `${started ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`; started = true; });

  return (
    <>
      <div className="head">
        <div style={{ display: "grid", gap: 4 }}>
          <span className="note">{new Date(today + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          <h1>Hallo, {subject.name.split(" ")[0]}</h1>
        </div>
        <div className="btnrow">
          {conns.map((c) => <span key={c.provider} className="tag on">{PNAME[c.provider] || c.provider}</span>)}
          <Link className="btn ghost sm" href="/quellen">Quellen verwalten</Link>
        </div>
      </div>

      {!hasAny && (
        <div className="panel">
          <h2>Noch keine Daten</h2>
          <p className="muted">Verbinde intervals.icu, Strava oder WHOOP unter „Quellen“. Zum Ausprobieren kannst du Beispieldaten laden, sie lassen sich jederzeit wieder löschen.</p>
          <div className="btnrow">
            <Link className="btn" href="/quellen">Quellen verbinden</Link>
            <form action={loadDemo}><button className="btn ghost" type="submit">Beispieldaten laden</button></form>
          </div>
        </div>
      )}

      <section className="grid2">
        <div className="panel">
          <div className="panel-head"><h2>Tagesform</h2><span className="note">bereinigt aus {recP.length ? recP.map((p) => PNAME[p] || p).join(" + ") : "–"}</span></div>
          <div className="ready">
            <Dial s={T?.score ?? null} delta={T?.score != null && Y?.score != null ? T.score - Y.score : null} />
            <div className="drivers">
              <span className={`pill ${stateOf(T?.score)}`}>{stateText(T?.score)}</span>
              {T?.z && ["hrv", "rhr", "sleep", "tsb"].map((k) => {
                const z = Math.max(-2.5, Math.min(2.5, T.z[k])), w = (Math.abs(z) / 2.5) * 50;
                return (
                  <div className="drv" key={k}><span>{labels[k]}</span>
                    <div className="meter"><i style={{ left: z >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: z >= 0 ? "var(--good)" : "var(--crit)" }} /></div>
                    <span className="num muted" style={{ textAlign: "right" }}>{z >= 0 ? "+" : ""}{z.toFixed(1)}σ</span></div>
                );
              })}
            </div>
          </div>
          <p className="note">Balken = Abweichung zur persönlichen 28-Tage-Baseline.{T?.night?.length ? ` Vorabend: ${T.night.map((t) => triggerName(t.t)).join(", ")}.` : ""}</p>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Empfehlung für heute</h2><span className={`tag ${advice ? "on" : ""}`}>{advice ? "KI-Coach" : "Regelbasiert"}</span></div>
          {advice ? <Advice a={advice} /> : <div className="coach">{recommend(T, zones, subject.sport)}</div>}
          {ai && hasAny ? (
            <ActionForm action={createAdvice} className="btnrow" submit={advice ? "Neu erstellen" : "KI-Empfehlung erstellen"} busy="Analysiert deine Daten…" reset={false} />
          ) : !ai ? <p className="note">Die KI-Empfehlung wird aktiv, sobald ein Admin Claude unter Admin → Schnittstellen freischaltet.</p> : null}
        </div>
      </section>

      {recP.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Quellenabgleich heute</h2><span className="note">Jedes Gerät misst anders. Gerechnet wird mit „Bereinigt“.</span></div>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Kennzahl</th>{recP.map((p) => <th key={p} className="r">{PNAME[p] || p}</th>)}<th className="r">Bereinigt</th></tr></thead>
            <tbody>
              {[["Recovery", "recovery", r0, "", T.score], ["HRV", "hrv", r0, " ms", T.hrv], ["Ruhepuls", "rhr", r0, " bpm", T.rhr], ["Schlaf", "sleep", r1, " h", T.sleep]].map(([lbl, k, f, u, clean]) => (
                <tr key={k}><td>{lbl}</td>{recP.map((p) => <td key={p} className="r num">{T.prov[p][k] == null ? "–" : f(T.prov[p][k]) + u}</td>)}<td className="r num clean">{clean == null ? "–" : f(clean) + u}</td></tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}

      {T && [T.sleepScore, T.bbHigh, T.stress, T.spo2, T.resp, T.readiness, T.vo2max, T.deep].some((v) => v != null) && (
        <section className="panel">
          <div className="panel-head"><h2>Garmin-Details letzte Nacht</h2><span className="note">Schlaf, Erholung, Atmung</span></div>
          <div className="hl" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
            {[["Sleep Score", T.sleepScore, (v) => Math.round(v), "/100"], ["Body Battery max", T.bbHigh, (v) => Math.round(v), ""], ["Body Battery min", T.bbLow, (v) => Math.round(v), ""],
              ["Stress Ø", T.stress, (v) => Math.round(v), ""], ["Training Readiness", T.readiness, (v) => Math.round(v), ""], ["SpO2 Ø", T.spo2, (v) => Math.round(v), " %"],
              ["Atmung", T.resp, (v) => v.toFixed(1), " /min"], ["Puls im Schlaf", T.sleepHr, (v) => Math.round(v), " bpm"], ["VO2max", T.vo2max, (v) => v.toFixed(1), ""],
              ["Hauttemperatur", T.skinTemp, (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`, " °C"], ["Intensitätsminuten", T.intensity, (v) => Math.round(v), ""]]
              .filter(([, v]) => v != null).map(([l, v, f, u]) => <div key={l} className="hli"><span>{l}</span><b>{f(v)}<small className="note">{u}</small></b></div>)}
          </div>
          {T.deep != null && (() => {
            const parts = [["Tief", T.deep, "#3A57F5"], ["REM", T.rem, "#A78BFA"], ["Leicht", T.light, "#9DB2FF"], ["Wach", T.awake, "#F6B94A"]].filter(([, v]) => v != null);
            const tot = parts.reduce((s, p) => s + p[1], 0) || 1;
            return (<>
              <h3>Schlafphasen</h3>
              <div className="sbar">{parts.map(([l, v, c]) => <i key={l} style={{ width: `${(v / tot) * 100}%`, background: c }} title={`${l} ${v.toFixed(1)} h`} />)}</div>
              <div className="slegend">{parts.map(([l, v, c]) => <span key={l}><i style={{ background: c }} />{l} <em>{Math.floor(v)}:{String(Math.round((v % 1) * 60)).padStart(2, "0")} h</em></span>)}</div>
            </>);
          })()}
        </section>
      )}

      <section className="grid2">
        <div className="panel chart">
          <div className="panel-head"><h2>Letzte 6 Wochen</h2><span className="note">Linie = Tagesform · Balken = Last</span></div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tagesform und Last der letzten 6 Wochen">
            {[0, 33, 67, 100].map((g) => <g key={g}><line x1={L} x2={W - Rr} y1={yS(g)} y2={yS(g)} stroke="var(--line)" /><text x={L - 6} y={yS(g) + 3} textAnchor="end">{g}</text></g>)}
            {days.map((d, i) => d.load > 0 && <rect key={d.day} x={x(i) - 3} y={yL(d.load)} width="6" height={H - B - yL(d.load)} rx="2" fill={d.str > d.end ? "var(--c-str)" : "var(--c-end)"} opacity=".35" />)}
            {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" />}
            {days.map((d, i) => (d.night || []).some((t) => t.t === "alkohol") && <path key={"a" + i} d={`M${x(i)},${H - B + 4} l4,7 h-8z`} fill="var(--warn)" />)}
            {days.map((d, i) => (i % 7 === 0 || i === days.length - 1) && <text key={"t" + i} x={x(i)} y={H - 2} textAnchor="middle">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}.</text>)}
          </svg>
          <div className="legend"><span><i style={{ background: "var(--accent)" }} />Tagesform</span><span><i style={{ background: "var(--c-end)", height: 8 }} />Ausdauer</span><span><i style={{ background: "var(--c-str)", height: 8 }} />Kraft</span><span><i style={{ background: "var(--warn)", width: 8, height: 8, clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />Alkohol am Vorabend</span></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Trigger heute</h2><span className="note">wirken auf morgen früh</span></div>
          <ActionForm action={addManual} submit="Eintragen">
            <input type="hidden" name="kind" value="trigger" />
            <input type="hidden" name="day" value={today} />
            <label className="f">Trigger<select name="t" defaultValue="alkohol">{TRIGGERS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label className="f">Menge (z. B. Gläser)<input type="number" name="value" min="1" max="20" step="1" defaultValue="1" /></label>
          </ActionForm>
          <ul className="list">
            {todayTrig.length ? todayTrig.map((t) => (
              <li key={t.id}><span className="tag wait">heute</span><span>{triggerName(t.data?.t)}{t.data?.t === "alkohol" ? ` · ${Number(t.value)} Gl.` : ""}</span>
                <form action={deleteManual}><input type="hidden" name="id" value={t.id} /><button className="x" type="submit" aria-label="Entfernen">✕</button></form></li>
            )) : <li style={{ gridTemplateColumns: "1fr" }}><span className="muted">Heute noch nichts eingetragen.</span></li>}
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Letzte Einheiten</h2><span className="note">Duplikate aus mehreren Quellen zusammengeführt</span></div>
        {activities.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Datum</th><th>Einheit</th><th className="r">Dauer</th><th className="r">Ø Puls</th><th className="r">Ø Watt</th><th className="r">Last</th><th>Quellen</th></tr></thead>
            <tbody>{activities.slice(0, 10).map((a) => (
              <tr key={a.provider + a.external_id}>
                <td className="num">{a.day.slice(8, 10)}.{a.day.slice(5, 7)}.</td>
                <td>{a.name || a.sport} <span className="src">{a.category === "str" ? "Kraft" : a.category === "other" ? "Alltag" : "Ausdauer"}</span></td>
                <td className="r num">{Math.floor(a.duration_s / 3600)}:{String(Math.round((a.duration_s % 3600) / 60)).padStart(2, "0")}</td>
                <td className="r num">{r0(a.avg_hr == null ? null : Number(a.avg_hr))}</td>
                <td className="r num">{r0(a.np_power || a.avg_power ? Number(a.np_power || a.avg_power) : null)}</td>
                <td className="r num">{Math.round(a.load)}</td>
                <td>{a.sources.map((s) => <span key={s} className="src" style={{ marginLeft: 0, marginRight: 4 }}>{PNAME[s] || s}</span>)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Workouts.</div>}
      </section>
    </>
  );
}
