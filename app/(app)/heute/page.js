import Link from "next/link";
import { pageContext } from "@/lib/subject";
import QuickLinks from "@/components/QuickLinks";
import { learnedText } from "@/lib/learn";
import EveningForm from "@/components/EveningForm";
import BodyAnalysis from "@/components/BodyAnalysis";
import { eveningMap } from "@/lib/evening";
import { loadSplit, ratioWord } from "@/lib/loadsplit";
import { buildSeries, todayIso, addDays, stateOf, stateText } from "@/lib/metrics";
import * as repo from "@/lib/repo";
import { TRIGGERS, triggerName, WEAKNESSES, range, fmtRange } from "@/lib/catalog";
import { addManual, deleteManual, loadDemo, createAdvice, createFeedback, createBrief, saveCheckin, rateSession, saveEvening } from "../../actions-data";
import { REGIONS, STATE_NAMES, stateColor } from "@/lib/state";
import { aiReady } from "@/lib/ai";
import { getTodayAdvice, todayModel, feedbackModel, getBrief, briefState, makeBrief } from "@/lib/coach";
import Brief from "@/components/Brief";
import { after } from "next/server";
import Tabs from "@/components/Tabs";
import Feedback from "@/components/Feedback";
import { ACT_LABEL } from "@/lib/adherence";
import ActionForm from "@/components/ActionForm";
import Targets from "@/components/Targets";
import Spark from "@/components/Spark";
import { trendTiles, findings, weekStatus } from "@/lib/overview";
import { vo2Summary } from "@/lib/vo2";
import { targetsOf } from "@/lib/targets";

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

const SCALE = { energy: ["Energie", "leer", "voll"], motivation: ["Motivation", "keine", "hoch"], stress: ["Stress", "ruhig", "hoch"] };
function Seg({ name, n = 5, from = 1, value }) {
  return <div className="pick">{Array.from({ length: n }, (_, k) => k + from).map((v) => (
    <label key={v}><input type="radio" name={name} value={v} defaultChecked={value === v} required={from === 1} /><span>{v}</span></label>
  ))}</div>;
}
function CheckinForm({ ck }) {
  return (
    <ActionForm action={saveCheckin} className="checkin" submit={ck ? "Aktualisieren" : "Einchecken"} busy="Speichert…" reset={false}>
      {Object.entries(SCALE).map(([k, [n, lo, hi]]) => (
        <div key={k} className="q"><span className="ql">{n}<small>1 = {lo} · 5 = {hi}</small></span><Seg name={k} value={ck?.[k]} /></div>
      ))}
      <div className="q"><span className="ql">Muskelkater<small>0 = nichts · 3 = stark</small></span>
        <div className="sore">{Object.entries(REGIONS).map(([r, n]) => <div key={r}><em>{n}</em><Seg name={`sore_${r}`} n={4} from={0} value={ck?.soreness?.[r] ?? 0} /></div>)}</div></div>
      <div className="q"><span className="ql">Zeit fürs Training heute</span>
        <select name="time_min" defaultValue={ck?.time_min ?? ""}><option value="">offen</option>{[0, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m === 0 ? "kein Training" : `${m} min`}</option>)}</select></div>
    </ActionForm>
  );
}
const RPE = [[1, "sehr leicht"], [2, "leicht"], [3, "locker"], [4, "moderat"], [5, "etwas hart"], [6, "hart"], [7, "sehr hart"], [8, "sehr hart+"], [9, "fast maximal"], [10, "maximal"]];

export const maxDuration = 60;

// Entscheidung des Regelwerks; die KI-Erklärung kommt dazu, wenn sie zu genau dieser Entscheidung gehört
function Decision({ d, a }) {
  const t = a ? new Date(a.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }) : null;
  const n = d.nutrition;
  return (
    <div className="adv">
      <div className="adv-head"><span className={`pill ${d.state}`}>{d.title}</span></div>
      {a?.summary && <p className="adv-sum">{a.summary}</p>}
      <dl>
        <div className="main"><dt>Heute</dt><dd><b>{d.main.what}</b> · {d.main.detail}{d.main.second && <span className="nl2"><b>+ {d.main.second.title}</b> ({d.main.second.min} min) · {d.main.second.detail}</span>}</dd></div>
        {d.avoid.length > 0 && <div className="no"><dt>Nicht empfohlen</dt><dd>{d.avoid.join(" · ")}</dd></div>}
        {d.alt && <div><dt>Alternative</dt><dd><b>{d.alt.what}</b> · {d.alt.detail}</dd></div>}
        <div><dt>Warum</dt><dd><ul>{(a?.why?.length ? a.why : d.why).map((w, i) => <li key={i}>{w}</li>)}</ul></dd></div>
        <div><dt>Ernährung</dt><dd>{a?.nutrition || <>
          <b>ca. {fmtRange(range(n.kcal), " kcal")}</b> · ca. {fmtRange(range(n.carbs_g, 0.1, 10), " g")} Kohlenhydrate · {fmtRange(range(n.protein_g, 0.08, 5), " g")} Protein · {fmtRange(range(n.fat_g, 0.12, 5), " g")} Fett · {n.fluid_l} l trinken
          {n.note && <span className="nl">{n.note}</span>}
          {[n.pre, n.during, n.post].filter(Boolean).map((x, i) => <span key={i} className="nl">{x}</span>)}
        </>}</dd></div>
        {a?.recovery && <div><dt>Erholung</dt><dd>{a.recovery}</dd></div>}
        <div><dt>Morgen</dt><dd>{d.tomorrow}</dd></div>
      </dl>
      {a?.watch?.length > 0 && <ul className="adv-watch">{a.watch.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      <p className="note">Entscheidung nach festen Regeln aus deinen Daten · Datenqualität {d.quality}{a ? ` · erklärt von der KI um ${t}` : ""}. Ersetzt keine ärztliche Beratung.</p>
    </div>
  );
}

// Wie bin ich drauf? Erholung (nur Messwerte der Nacht) · Bereitschaft (heute belastbar, inkl. Check-in) · fünf Bereiche
const sg = (v, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`;
function Status({ T, st, cx, ls }) {
  const m = Object.fromEntries((cx || []).map((x) => [x.k, x]));
  const S = st?.states;
  const parts = S ? [["Herz-Kreislauf", S.cardio.value], ["Beine", S.muscle.regions.legs.value], ["Oberkörper", S.muscle.regions.upper.value], ["Schlaf", S.sleep.value], ["Stress & Energie", S.stress.value]] : [];
  const night = [
    m.sleep && `Schlaf ${m.sleep.value} h${m.sleep.base != null ? ` (${sg((m.sleep.value - m.sleep.base) * 60)} min)` : ""}`,
    m.hrv && `HRV ${m.hrv.value} ms${m.hrv.delta != null ? ` (${sg(m.hrv.delta)} %)` : ""}`,
    m.rhr && `Ruhepuls ${m.rhr.value}${m.rhr.base != null ? ` (${sg(m.rhr.value - m.rhr.base)})` : ""}`,
  ].filter(Boolean);
  return (
    <div className="stat">
      {/* Eine Zahl: Bereitschaft. Die reine Nacht-Erholung nur, wenn der Check-in sie verschiebt */}
      <div className="stat-big one">
        <div className={`sb ${stateOf(T?.score)}`}><span>Bereitschaft heute</span><b>{T?.score ?? "–"}<small className="of">/100</small></b><small className={`pill ${stateOf(T?.score)}`}>{stateText(T?.score)}</small></div>
        <div className="sb-side">
          {T?.scoreObj != null && T?.checkin && T.scoreObj !== T.score ? <p><b>{T.scoreObj}</b> aus den Messwerten der Nacht, dein Check-in {T.score > T.scoreObj ? "hebt" : "senkt"} sie auf {T.score}.</p>
            : <p>{T?.scoreObj == null ? (T?.score != null ? "Nur aus deinem Check-in – keine Messwerte der Nacht." : "Noch keine Werte für heute.") : T?.checkin ? "Messwerte der Nacht + Check-in." : "Aus den Messwerten der Nacht. Mit dem Check-in wird sie genauer."}</p>}
          {night.length ? <p className="note">{night.join(" · ")} · vs. dein Ø</p> : <p className="note">HRV, Ruhepuls und Schlaf von heute fehlen – Garmin-App synchronisieren; in intervals.icu die Wellness-Daten erlauben.</p>}
        </div>
      </div>
      <div className="parts">{parts.map(([n, v]) => (
        <div key={n} className="drv"><span>{n}</span><div className="meter m2"><i style={{ width: `${v ?? 0}%`, background: `var(--${stateColor(v)})` }} /></div><span className="num" style={{ textAlign: "right", fontWeight: 600 }} title={v == null ? "keine Daten von heute" : undefined}>{v ?? "–"}</span></div>
      ))}</div>
      {ls && (
        <div className="loads"><span className="lbl">Belastung 7 Tage vs. dein Schnitt</span>
          {[["Herz-Kreislauf", ls.cardio], ["Beine", ls.muscle.legs], ["Oberkörper", ls.muscle.upper], ["Volumen", ls.hours, `${ls.hours.w7.toFixed(1)} h`]].filter(([, x]) => x.avg || x.w7).map(([n, x, extra]) => (
            <span key={n} className={`ld ${x.ratio == null ? "" : x.ratio > 1.4 ? "hi" : x.ratio < 0.7 ? "lo" : ""}`} title={ratioWord(x.ratio)}><em>{n}</em>{extra ? `${extra} · ` : ""}{x.ratio == null ? "neu" : `${x.ratio.toFixed(1)}×`}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Was kommt als Nächstes? Die nächsten Tage aus dem (adaptiven) Plan, nächster Wettkampf, was Formstand gelernt hat
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function Next({ items, today, week, phase, learned, base }) {
  const moved = (week || []).filter((x) => x.movedTo || x.dropped).filter((x) => x.day >= today);
  return (
    <section className="panel">
      <div className="panel-head"><h2>Als Nächstes</h2><Link className="note" href={`${base}/ziele#plan`}>Wochenplan →</Link></div>
      <div className="nextd">{items.map((x) => (
        <div key={x.day} className={`nd t-${x.type}`}>
          <span className="note">{WD[new Date(x.day + "T12:00:00Z").getUTCDay()]} {x.day.slice(8, 10)}.{x.day.slice(5, 7)}.</span>
          <b>{x.title}</b>
          <span className="note">{x.min ? `${x.min} min` : "frei"}{x.moved ? " · nachgeholt" : ""}{x.second ? ` + ${x.second.title}` : ""}</span>
        </div>
      ))}</div>
      {moved.map((x) => <p key={x.day} className="note">{x.dropped ? `„${x.title}“ passt diese Woche nicht mehr mit genug Erholung hinein und fällt weg.` : `„${x.title}“ ist auf ${WD[new Date(x.movedTo + "T12:00:00Z").getUTCDay()]} verschoben.`}</p>)}
      {phase?.event && phase.daysTo > 0 && <p className="note"><b>{phase.label}</b> · noch {phase.daysTo} Tage bis {phase.event.name}</p>}
      {learned?.n >= 8 && <p className="note">{learnedText(learned)}</p>}
    </section>
  );
}

export default async function Heute({ demo } = {}) {
  const { subject, viewer, base } = await pageContext(demo);
  const M = await todayModel(subject.id);
  const { today, all, activities, providers, st, cx: ctxv, decision, triggers, phase, yesterday, hasGoals, manual, learned, week, upcoming, goals } = M;
  const [ai, advice] = await Promise.all([aiReady(), getTodayAdvice(subject.id)]);
  const hasAny = activities.length || providers.length;
  const tg = targetsOf(goals, manual, all, today);
  const tiles = trendTiles(all, vo2Summary(all, manual, subject, today));
  const fnd = findings(all, { activities, st, goals, triggers });
  // Rückblick & Feedback: Woche, Vorwoche, 30 Tage, 90 Tage (+ gespeichertes KI-Feedback je Zeitraum)
  const fbs = all.length > 40 ? await feedbackModel(subject.id, M) : [];
  const fbAi = await repo.getFeedback(subject.id);
  const aiFor = (f) => Object.values(fbAi).filter((x) => x.period === f.key && x.key.startsWith(`${f.key}:${f.from}`)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null;
  // Wochenbrief: der neuste; fehlt der dieser Woche, entsteht er im Hintergrund (einmal pro Woche)
  const brief = viewer.demo ? null : await getBrief(subject.id);
  const bState = viewer.demo ? null : await briefState(subject.id, today);
  if (ai && !viewer.demo && hasAny && all.length > 40 && bState && !bState.done && !bState.pending && !bState.error) {
    bState.pending = true;
    after(async () => { try { await makeBrief(subject.id); } catch {} });
  }
  const fbStart = new Date(today + "T12:00:00Z").getUTCDay() === 1 ? 1 : 0;
  const ws = hasGoals ? weekStatus(week, all, activities, today) : null;
  const days = all.slice(-42);
  const T = days[days.length - 1], Y = days[days.length - 2];
  const ck = T?.checkin || null;
  const unrated = activities.filter((a) => a.category !== "other" && !a.rpe && a.day >= addDays(today, -3)).slice(0, 4);
  const conns = await repo.getConnections(subject.id);
  const pushOn = viewer.demo ? true : (await repo.getPushSubs(viewer.id)).length > 0;
  const todayTrig = (await repo.getManual(subject.id)).filter((e) => e.kind === "trigger" && e.day === today);
  const recP = Object.keys(T?.prov || {});
  const fresh = advice && decision && advice.decision_key === decision.key ? advice : null;
  const bodyAna = Object.values(await repo.getBodyAnalyses(subject.id)).sort((a, b) => (a.day < b.day ? 1 : -1))[0] || null;
  const hasBodyPhotos = !bodyAna && (await repo.getMedia(subject.id)).some((m) => m.kind === "body_photo");
  const measuredBf = (() => { const b = manual.filter((m) => m.kind === "bodyfat").sort((a, b) => (a.day < b.day ? 1 : -1))[0]; return b ? Number(b.value) : null; })();

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
          {phase && <Link href={`${base}/ziele`} className="phaseline"><span className="tag on">{phase.label}</span>{phase.event && phase.daysTo > 0 ? <span>noch <b>{phase.daysTo} Tage</b> bis {phase.event.name}</span> : null}</Link>}
        </div>
        <div className="btnrow">
          {conns.map((c) => <span key={c.provider} className="tag on">{PNAME[c.provider] || c.provider}</span>)}
          <Link className="btn ghost sm" href={base ? "/register" : "/quellen"}>Quellen verwalten</Link>
        </div>
      </div>

      {hasAny && (
        <nav className="subnav jump" aria-label="Auf dieser Seite">
          <a href="#drauf">Heute</a><a href="#rueckblick">Rückblick</a><a href="#auffaellig">Was auffällt</a>{!viewer.demo && <a href="#coach">Wochenbrief</a>}<a href="#trends">Trends</a>{ws && <a href="#woche">Woche</a>}{tg.length > 0 && <a href="#ziele">Ziele</a>}<a href="#faktoren">Einflussfaktoren</a>
        </nav>
      )}

      {!hasAny && (
        <div className="panel">
          <h2>Noch keine Daten</h2>
          <p className="muted">Verbinde intervals.icu, Strava oder WHOOP unter „Quellen“. Zum Ausprobieren kannst du Beispieldaten laden, sie lassen sich jederzeit wieder löschen.</p>
          <div className="btnrow">
            <Link className="btn" href={base ? "/register" : "/quellen"}>Quellen verbinden</Link>
            {!base && <Link className="btn ghost" href="/anleitung#garmin">Schritt-für-Schritt-Anleitung</Link>}
            <form action={loadDemo}><button className="btn ghost" type="submit">Beispieldaten laden</button></form>
          </div>
        </div>
      )}
      {!ck && (hasAny || !viewer.demo) && (
        <section className="panel ckpanel" id="checkin">
          <div className="panel-head"><h2>Guten Morgen! Wie fühlst du dich?</h2><span className="note">5 Sekunden · macht Bereitschaft und Empfehlung deutlich genauer</span></div>
          <CheckinForm ck={null} />
        </section>
      )}

      {hasAny && (
        <section className="home2">
          <div className="panel status">
            <div className="panel-head"><h2 id="drauf">Wie bin ich drauf?</h2><span className="note">{recP.length ? `aus ${recP.map((p) => PNAME[p] || p).join(" + ")}` : ""}{ck ? " · mit Check-in" : ""}</span></div>
            <Status T={T} st={st} cx={ctxv} ls={loadSplit(all)} />
            {st && (
            <div className="why">
              <p><span className={`q-${st.quality.level}`}>Datenqualität {st.quality.level}</span> · {st.quality.have}/{st.quality.of} Signale{st.quality.missing.length ? <span className="note"> (fehlt: {st.quality.missing.join(", ")})</span> : null}</p>
              {st.drivers.length > 0 && <p><b>Haupttreiber:</b> {st.drivers.join(" · ")}</p>}
              <p><b>Limiter:</b> {st.limiter ? `${st.limiter.name}${st.limiter.why ? ` – ${st.limiter.why}` : ""}` : "keiner"}</p>
              <details><summary>Alle Faktoren</summary>
                {Object.entries(st.states).map(([k, x]) => <div key={k} className="fx"><b>{STATE_NAMES[k]}</b>{x.drivers.length ? x.drivers.map((d, i) => <span key={i} className={d.z > 0.3 ? "up" : d.z < -0.3 ? "down" : ""}>{d.t}</span>) : <span className="note">keine Daten</span>}</div>)}
                {T?.scoreObj != null && ck && <p className="note">Messwerte allein: {T.scoreObj}/100. Dein Check-in zählt zu einem Viertel mit.</p>}
              </details>
              {ck && <details id="checkin"><summary>Check-in von heute ändern</summary><CheckinForm ck={ck} /></details>}
            </div>
          )}
          </div>
        <div className="panel" id="entscheidung">
          <div className="panel-head"><h2>Entscheidung für heute</h2><span className={`tag ${fresh ? "on" : ""}`}>{fresh ? "mit KI-Erklärung" : "Regelwerk"}</span></div>
          {decision ? <Decision d={decision} a={fresh} /> : <div className="empty">Sobald Recovery-Daten da sind oder du eincheckst, steht hier die Entscheidung für heute.</div>}
          {viewer.demo || !decision ? null : ai ? (
            <ActionForm action={createAdvice} className="btnrow" submit={fresh ? "KI-Erklärung neu schreiben" : advice ? "KI-Erklärung aktualisieren" : "Von der KI erklären lassen"} busy="Schreibt…" reset={false} />
          ) : <p className="note">Mit Claude (Admin → Schnittstellen) erklärt die KI die Entscheidung zusätzlich persönlich.</p>}
        </div>
        </section>
      )}

      {hasAny && fbs.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2 id="rueckblick">Rückblick & Feedback</h2><span className="note">Woche, Monat und Gesamtbild – jeweils gegen den Zeitraum davor</span></div>
          <Tabs labels={fbs.map((f) => f.label)} start={fbStart}>
            {fbs.map((f) => <Feedback key={f.key} f={f} ai={aiFor(f)} aiOn={ai} ro={Boolean(viewer.demo)} action={createFeedback} />)}
          </Tabs>
        </section>
      )}

      {hasAny && fnd.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2 id="auffaellig">Was auffällt</h2><span className="note">automatisch erkannt aus deinen Daten · wichtigstes zuerst</span></div>
          <div className="finds">{fnd.slice(0, 6).map((f) => (
            <div key={f.title} className={`find ${f.tone}`}><b>{f.title}</b><p>{f.text}</p></div>
          ))}</div>
        </section>
      )}

      {hasAny && !viewer.demo && (
        <section className="panel">
          <div className="panel-head"><h2 id="coach">Dein Coach · Wochenbrief</h2><span className="note">alles zusammen, in Worten – jeden Montag neu</span></div>
          <Brief b={brief} state={bState} ai={ai} ro={Boolean(viewer.demo)} action={createBrief} />
        </section>
      )}

      {hasAny && tiles.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2 id="trends">Trends</h2><span className="note">letzte 4 Wochen · Band = dein Normalbereich, gestrichelt = dein Ø</span></div>
          <div className="tiles">{tiles.map((t) => (
            <Link key={t.k} href={t.k === "vo2max" ? `${base}/tests#vo2` : `${base}/entwicklung`} className={`tile ${t.tone}`}>
              <span className="tl">{t.label}{t.stale && <small className="note"> · {t.day.slice(8, 10)}.{t.day.slice(5, 7)}.</small>}</span>
              <b>{t.cur}<small className="note"> {t.unit}</small></b>
              <Spark pts={t.pts} m={t.k === "ctl" || t.k === "tsb" || t.k === "weight" ? null : t.m} s={t.k === "ctl" || t.k === "tsb" || t.k === "weight" ? null : t.s} tone={t.tone} />
              {t.text && <small className={`tt ${t.tone}`}>{t.text}</small>}
            </Link>
          ))}</div>
        </section>
      )}

      {ws && (
        <section className="panel">
          <div className="panel-head"><h2 id="woche">Diese Woche</h2><span className="note">{Math.round(ws.doneMin / 6) / 10} von {Math.round(ws.plannedMin / 6) / 10} h · Schlüsseleinheiten {ws.keyDone}/{ws.key.length}</span><Link className="note" href={`${base}/ziele#plan`}>Plan anpassen →</Link></div>
          <div className="pbar"><i style={{ width: `${ws.plannedMin ? Math.min(100, (ws.doneMin / ws.plannedMin) * 100) : 0}%` }} /></div>
          <div className="wk">{ws.days.map((d) => (
            <div key={d.day} className={`wkd s-${d.status}${d.isToday ? " today" : ""}`}>
              <span className="note">{WD[new Date(d.day + "T12:00:00Z").getUTCDay()]} {d.day.slice(8, 10)}.</span>
              <b>{d.title}</b>
              <span className="note">{d.planned ? `${d.planned} min geplant` : "frei"}</span>
              <span className={`wks`}>{{ erledigt: "✓ erledigt", teilweise: "~ teilweise", verpasst: "– verpasst", zusätzlich: "+ zusätzlich", ruhe: "Ruhe", offen: d.isToday ? "heute" : "offen" }[d.status]}{d.doneMin ? ` · ${d.doneMin} min` : ""}</span>
              {d.acts.length > 0 && <small className="note">{d.acts.join(", ")}</small>}
            </div>
          ))}</div>
        </section>
      )}

      {tg.length > 0 ? (
        <section className="panel">
          <div className="panel-head"><h2 id="ziele">Deine Ziele · auf Kurs?</h2><span className="note">{(() => { const m = tg.filter((t) => !t.free && t.cur != null); return m.length ? `${m.filter((t) => t.tone === "good").length} von ${m.length} auf Kurs` : "neu gesetzt – Stand nach der nächsten Messung"; })()}</span></div>
          <Targets list={tg} compact base={base} />
        </section>
      ) : hasAny && !viewer.demo && (
        <div className="notice">Noch keine messbaren Ziele. <Link href={`${base}/ziele#meineziele`}>Ziel setzen →</Link> – z. B. 5 kg weniger bis Juni oder Kniebeuge 120 kg. Plan, Ernährung und Empfehlungen richten sich dann danach.</div>
      )}

      {hasGoals && upcoming?.length > 0 && <Next items={upcoming} today={today} week={week} phase={phase} learned={learned} base={base} />}

      {(bodyAna || hasBodyPhotos) && (
        <section className="panel">
          <div className="panel-head"><h2>Körper</h2><Link className="note" href={`${base}/bilder#analyse`}>{bodyAna ? "Ganze Analyse →" : "Zur Analyse →"}</Link></div>
          {bodyAna ? <BodyAnalysis a={bodyAna} measured={measuredBf} compact /> : <p className="muted">Deine Körperfotos sind noch nicht ausgewertet. Unter Körper → Analyse schätzt die KI Körperfett, Stärken und Potenzial und schlägt den passenden Trainingsfokus vor.</p>}
        </section>
      )}

      {yesterday && (
        <section className={`panel yday y-${yesterday.status}`}>
          <span className="note">Gestern</span>
          <span>Empfohlen: <b>{yesterday.rec.title}</b></span>
          <span>Gemacht: <b>{ACT_LABEL[yesterday.act.kind]}</b>{yesterday.act.min ? ` · ${yesterday.act.min} min` : ""}</span>
          <span className={`tag ${{ gefolgt: "on", teilweise: "wait", anders: "err", ausgelassen: "" }[yesterday.status]}`}>{{ gefolgt: "✓ gefolgt", teilweise: "~ teilweise", anders: "↑ härter als empfohlen", ausgelassen: "– ausgelassen" }[yesterday.status]}</span>
          {yesterday.scoreThen != null && yesterday.scoreNow != null && <span className="note">Bereitschaft {yesterday.scoreThen} → {yesterday.scoreNow} ({yesterday.scoreNow - yesterday.scoreThen >= 0 ? "+" : ""}{yesterday.scoreNow - yesterday.scoreThen})</span>}
          <Link href={`${base}/ziele`} className="note">Verlauf →</Link>
        </section>
      )}
      {unrated.length > 0 && !viewer.demo && (
        <section className="panel">
          <div className="panel-head"><h2>Wie hart war's?</h2><span className="note">Ein Tipp pro Einheit. Damit kann Formstand Kraft und Ausdauer fair vergleichen.</span></div>
          <div className="rate">{unrated.map((a) => (
            <ActionForm key={a.feelKey} action={rateSession} className="rate-row" submit="OK" busy="…">
              <input type="hidden" name="key" value={a.feelKey} /><input type="hidden" name="day" value={a.day} />
              <span><b>{a.name || a.sport}</b> <span className="note">{a.day.slice(8, 10)}.{a.day.slice(5, 7)}. · {Math.round(a.duration_s / 60)} min</span></span>
              <select name="rpe" defaultValue="" required><option value="" disabled>Anstrengung 1–10</option>{RPE.map(([v, n]) => <option key={v} value={v}>{v} · {n}</option>)}</select>
              {a.category === "str" && <select name="region" defaultValue="full"><option value="full">Ganzkörper</option><option value="legs">Beine</option><option value="upper">Oberkörper</option></select>}
            </ActionForm>
          ))}</div>
        </section>
      )}

      <details className="panel more-data" id="faktoren" open={todayTrig.length > 0 || undefined}>
        <summary><h2>Einflussfaktoren</h2><span className="note">{todayTrig.length ? `heute: ${todayTrig.map((t) => (t.data?.t === "alkohol" ? `Alkohol ${t.value} Gl.` : triggerName(t.data?.t))).join(", ")}` : "Alkohol, Stress, spätes Essen … für heute eintragen"}</span></summary>
        <Link className="note" href={`${base}/tagebuch#trigger`}>Mehrere Tage nachtragen →</Link>
        <EveningForm entries={eveningMap(manual, addDays(today, -60))} today={today} action={saveEvening} factors={TRIGGERS.filter(([k]) => k !== "alkohol")} />
        {todayTrig.length > 0 && <p className="note">{todayTrig.map((t) => { const r = triggers.find((x) => x.k === t.data?.t); return r && r.metrics.hrv?.diff != null && r.level !== "zu wenig Daten" && r.level !== "kein klarer Effekt" ? `Deine Reaktion nach ${triggerName(t.data?.t)}: HRV ${r.metrics.hrv.diff > 0 ? "+" : "−"}${Math.abs(Math.round(r.metrics.hrv.diff))} %${r.recovery != null ? `, normal nach Ø ${r.recovery.toFixed(1)} Tagen` : ""}. ` : ""; }).join("")}</p>}
      </details>

      {!viewer.demo && subject.id === viewer.id && (() => {
        const steps = [
          ["Quelle verbunden", conns.length > 0, "/quellen", "/anleitung#garmin"],
          ["Daten sind da", providers.length > 0 || activities.length > 0, "/quellen", "/anleitung#garmin"],
          ["Einmal eingecheckt", manual.some((m) => m.kind === "checkin"), "/heute#checkin", "/anleitung#taeglich"],
          ["Ziele & Schwächen gesetzt", hasGoals, "/ziele", "/anleitung#ziele"],
          ["Morgen-Erinnerung an", pushOn, "/konto", "/anleitung#push"],
          ["Ersten Test eingetragen", manual.some((m) => m.kind === "test"), "/tests", "/anleitung#tests"],
        ];
        const done = steps.filter((x) => x[1]).length;
        if (done === steps.length) return null;
        return (
          <section className="panel onb">
            <div className="panel-head"><h2>Erste Schritte · {done}/{steps.length}</h2><Link className="note" href="/anleitung">Ganze Anleitung →</Link></div>
            <div className="pbar"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
            <ol className="onb-l">{steps.map(([t, ok, href, help]) => (
              <li key={t} className={ok ? "ok" : ""}><span className="chk">{ok ? "✓" : ""}</span>{ok ? <span>{t}</span> : <Link href={href}>{t}</Link>}{!ok && <Link className="note" href={help}>wie?</Link>}</li>
            ))}</ol>
          </section>
        );
      })()}

      <details className="panel more-data">
        <summary><h2>Mehr Daten von heute</h2><span className="note">Werte im Kontext, Nacht, Verlauf, Einheiten</span></summary>
      {ctxv.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Deine Werte im Kontext</h2><span className="note">verglichen mit dir selbst: Ø der letzten 28 Tage und Rang in 12 Monaten</span></div>
          <div className="hl ctx">
            {ctxv.map((m) => (
              <div key={m.k} className="hli">
                <span>{m.label}</span>
                <b>{m.value}<small className="note">{m.unit}</small></b>
                {m.delta != null && <em className={m.good === true ? "up" : m.good === false ? "down" : ""}>{m.delta > 0 ? "+" : ""}{Math.abs(m.delta) < 10 ? m.delta.toFixed(1) : Math.round(m.delta)} % vs. Ø {m.base}</em>}
                {m.pct != null && <small className="note">{m.pct}. Perzentil · 12 Mon.</small>}
              </div>
            ))}
          </div>
        </section>
      )}
      {T && [T.sleepScore, T.bbHigh, T.stress, T.spo2, T.resp, T.readiness, T.vo2max, T.deep].some((v) => v != null) && (
        <section className="panel">
          <div className="panel-head"><h2>Weitere Details letzte Nacht</h2><span className="note">Schlafphasen und Zusatzwerte</span></div>
          <div className="hl" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
            {[["Body Battery min", T.bbLow, (v) => Math.round(v), ""], ["Training Readiness", T.readiness, (v) => Math.round(v), ""], ["SpO2 Ø", T.spo2, (v) => Math.round(v), " %"],
              ["Puls im Schlaf", T.sleepHr, (v) => Math.round(v), " bpm"], ["Hauttemperatur", T.skinTemp, (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`, " °C"], ["Intensitätsminuten", T.intensity, (v) => Math.round(v), ""]]
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
      <section className="grid2e">
        <div className="panel chart">
          <div className="panel-head"><h2>Letzte 6 Wochen</h2><span className="note">Linie = Bereitschaft · Balken = Last</span></div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bereitschaft und Last der letzten 6 Wochen">
            {[0, 33, 67, 100].map((g) => <g key={g}><line x1={L} x2={W - Rr} y1={yS(g)} y2={yS(g)} stroke="var(--line)" /><text x={L - 6} y={yS(g) + 3} textAnchor="end">{g}</text></g>)}
            {days.map((d, i) => d.load > 0 && <rect key={d.day} x={x(i) - 3} y={yL(d.load)} width="6" height={H - B - yL(d.load)} rx="2" fill={d.str > d.end ? "var(--c-str)" : "var(--c-end)"} opacity=".35" />)}
            {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" />}
            {days.map((d, i) => (d.night || []).some((t) => t.t === "alkohol") && <path key={"a" + i} d={`M${x(i)},${H - B + 4} l4,7 h-8z`} fill="var(--warn)" />)}
            {days.map((d, i) => (i % 7 === 0 || i === days.length - 1) && <text key={"t" + i} x={x(i)} y={H - 2} textAnchor="middle">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}.</text>)}
          </svg>
          <div className="legend"><span><i style={{ background: "var(--accent)" }} />Bereitschaft</span><span><i style={{ background: "var(--c-end)", height: 8 }} />Ausdauer</span><span><i style={{ background: "var(--c-str)", height: 8 }} />Kraft</span><span><i style={{ background: "var(--warn)", width: 8, height: 8, clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />Alkohol am Vorabend</span></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Letzte Einheiten</h2><span className="note">Duplikate aus mehreren Quellen zusammengeführt</span></div>
        {activities.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Datum</th><th>Einheit</th><th className="r">Dauer</th><th className="r">Ø Puls</th><th className="r">Ø Watt</th><th className="r">Last</th><th className="r">Gefühl</th><th>Quellen</th></tr></thead>
            <tbody>{activities.slice(0, 10).map((a) => (
              <tr key={a.provider + a.external_id}>
                <td className="num">{a.day.slice(8, 10)}.{a.day.slice(5, 7)}.</td>
                <td>{a.name || a.sport} <span className="src">{a.category === "str" ? "Kraft" : a.category === "other" ? "Alltag" : "Ausdauer"}</span></td>
                <td className="r num">{Math.floor(a.duration_s / 3600)}:{String(Math.round((a.duration_s % 3600) / 60)).padStart(2, "0")}</td>
                <td className="r num">{r0(a.avg_hr == null ? null : Number(a.avg_hr))}</td>
                <td className="r num">{r0(a.np_power || a.avg_power ? Number(a.np_power || a.avg_power) : null)}</td>
                <td className="r num">{Math.round(a.load)}</td>
                <td className="r num">{a.rpe ? `${a.rpe}/10` : "–"}{a.region && a.category === "str" ? <span className="src">{{ legs: "Beine", upper: "Oberk.", full: "Ganzk." }[a.region]}</span> : null}</td>
                <td>{a.sources.map((s) => <span key={s} className="src" style={{ marginLeft: 0, marginRight: 4 }}>{PNAME[s] || s}</span>)}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Workouts.</div>}
      </section>
      </details>

      <section className="panel">
        <div className="panel-head"><h2>Weitere Bereiche</h2></div>
        <QuickLinks base={base} demo={Boolean(viewer.demo)} />
      </section>
    </>
  );
}
