import Link from "next/link";
import { pageContext } from "@/lib/subject";
import { todayModel } from "@/lib/coach";
import { weekPlan, mondayOf, DAYS, PHASES } from "@/lib/plan";
import { review, summarize, ACT_LABEL } from "@/lib/adherence";
import { changes } from "@/lib/insights";
import { bodyProgress } from "@/lib/body";
import { periodReview, reviewText } from "@/lib/weekly";
import * as repo from "@/lib/repo";
import { FOCUS, EVENT_TYPES, WEAKNESSES, range, fmtRange } from "@/lib/catalog";
import { saveGoals, addEvent, deleteEvent, savePlanDay, deleteFixed, findEvent, addTarget, deleteTarget, adoptWeaknesses } from "../../actions-data";
import Targets from "@/components/Targets";
import TargetForm from "@/components/TargetForm";
import { FitnessWork } from "@/components/FitnessProfile";
import { fitnessProfile } from "@/lib/fitness";
import { vo2Summary } from "@/lib/vo2";
import { targetsOf, currentValues, TARGET_METRICS } from "@/lib/targets";
import { TEST_TYPES, testText } from "@/lib/catalog";
import EventFinder from "@/components/EventFinder";
import DayEditor from "@/components/DayEditor";
import { aiReady } from "@/lib/ai";
import { intensityDist, intensityTarget, intensityVerdict } from "@/lib/intensity";
import ActionForm from "@/components/ActionForm";
import Dictate from "@/components/Dictate";

export const maxDuration = 60;
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const short = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const addD = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TYPE = { rest: ["Ruhe", "none"], easy: ["Locker", "warn"], long: ["Lang", "next"], quality: ["Qualität", "on"], strength: ["Kraft", "str"], race: ["Wettkampf", "race"], opener: ["Aktivierung", "warn"], endurance: ["Grundlage", "warn"], recovery: ["Erholung", "none"] };
const STATUS = { gefolgt: ["✓ gefolgt", "on"], teilweise: ["~ teilweise", "wait"], anders: ["↑ härter", "err"], ausgelassen: ["– ausgelassen", ""] };
const DAYNAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export default async function Ziele({ searchParams, demo } = {}) {
  const sp = await searchParams;
  const { subject, viewer, base } = await pageContext(demo);
  const m = await todayModel(subject.id);
  const { goals, today, all, zones, decision, phase } = m;
  const week = sp?.w === "1" ? 1 : 0;
  const plan0 = weekPlan(goals, addD(mondayOf(today), 7 * week), m.user || {}, zones);
  // Diese Woche adaptiv: verpasste oder heute gestrichene harte Einheiten sind bereits verschoben
  const plan = week === 0 && m.week ? { ...plan0, items: m.week } : plan0;
  const rowsAll = review(all, { ...m.ctx, goals: m.hasGoals ? goals : null }, 62);
  const rows = rowsAll.slice(-28);
  const sum = summarize(rows);
  const mon = mondayOf(today), lw = periodReview(all, rowsAll, addD(mon, -7), addD(mon, -1));
  const firstThis = today.slice(0, 8) + "01", firstPrev = (() => { const d = new Date(firstThis + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
  const lm = periodReview(all, rowsAll, firstPrev, addD(firstThis, -1));
  const monthName = new Date(firstPrev + "T12:00:00Z").toLocaleDateString("de-CH", { month: "long" });
  const body = bodyProgress(all, m.manual, goals);
  const showBody = goals.focus === "cut" || goals.focus === "muscle" || goals.targetWeight || goals.targetBodyfat;
  const manual = await repo.getManual(subject.id);
  const ch = Object.fromEntries(changes(all, { focus: goals.focus, manual }).map((c) => [c.key, c]));
  const weak = [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean);
  const nextA = (goals.events || []).find((e) => e.priority === "A" && e.date >= today);
  const ro = viewer.demo;
  const tg = targetsOf(goals, manual, all, today);
  const tMetrics = Object.fromEntries(Object.entries(TARGET_METRICS).map(([k, x]) => [k, { name: x.name, unit: x.unit, group: x.group, time: Boolean(x.time), step: x.step || 1 }]));
  const kgNow = Number(m.user?.weight_kg) || null;
  const fp = fitnessProfile(manual, { sex: subject.sex, kg: kgNow, goals, profile: subject, today, vo2: vo2Summary(all, manual, subject, today) });
  // Test-Verlauf je Schwäche (z. B. Kraft Beine → Kniebeuge 1RM vorher/nachher)
  const testFor = (w) => { const x = fp.tests.filter((t) => t.area === w && t.prev); return x.length ? x.map((t) => `${t.name}: ${t.prev.text} → ${t.text}`).join(" · ") : null; };
  const iv = intensityVerdict(intensityDist(all), intensityTarget({ goals, phase: m.hasGoals ? phase : null, weak }));

  // Fortschritt je Schwäche: absolvierte Fokus-Einheiten + passende Kennzahl
  const metricFor = (w) => {
    const c = { schwelle: ch.ftp, vo2: ch.vo2max, grundlage: ch.ctl, langstrecke: ch.ctl, erholung: ch.hrv, koerper: ch.bodyfat || ch.weight, kraft_beine: ch.str, kraft_ober: ch.str, hyrox_stationen: ch.str }[w];
    if (!c) return null;
    return c.val == null ? c.text : `${c.label} ${c.val > 0 ? "+" : ""}${c.val.toFixed(c.dec ?? 1)}${c.unit || ""}${c.extra ? ` (${c.extra})` : ""} in 90 Tagen${c.sig ? "" : " · noch im Rauschen"}`;
  };

  return (
    <>
      <div className="head">
        <div style={{ display: "grid", gap: 4 }}>
          <h1>Ziele & Plan</h1>
          <p>Wettkämpfe, Schwächen und Zeitbudget bestimmen den Wochenplan. Die Tagesentscheidung folgt dem Plan, solange dein Körper mitmacht.</p>
        </div>
        {phase && <div className="phasebox"><span className="tag on">{phase.label}</span>{phase.event && phase.daysTo > 0 && <b>{phase.daysTo} Tage bis {phase.event.name}</b>}</div>}
      </div>
      {ro && <div className="notice warn">Demo: Ziele und Wettkämpfe sind Beispiele. Mit eigenem Konto trägst du hier deine eigenen ein.</div>}

      <section className="panel">
        <div className="panel-head"><h2 id="meineziele">Meine Ziele</h2><span className="note">Was willst du bis wann erreichen? Plan, Ernährung und KI richten sich danach.</span></div>
        {tg.length ? <Targets list={tg} del={deleteTarget} ro={ro} /> : <p className="muted">Noch keine messbaren Ziele. Beispiele: Körpergewicht 78 kg bis 30.06., Kniebeuge 140 kg (1RM geschätzt) bis Ende Jahr, 5 km unter 22:00 bis zum Frühling.</p>}
        {!ro && (
          <details className="stack" open={!tg.length}>
            <summary className="note" style={{ cursor: "pointer", fontWeight: 600 }}>+ Neues Ziel</summary>
            <TargetForm action={addTarget} metrics={tMetrics} current={currentValues(manual, all)} today={today} minDay={addD(today, 7)} />
          </details>
        )}
        <p className="note">So wirken Ziele: Ein Abnehmziel stellt die Ernährung auf das nötige Tempo ein (max. 1 % pro Woche). Ein Kraft-, Lauf- oder FTP-Ziel setzt Fokus-Einheiten im Wochenplan. Die KI bezieht sich in jeder Empfehlung darauf. Der Strich im Balken zeigt, wo du nach der verstrichenen Zeit stehen solltest.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 id="plan">Wochenplan</h2>
          <div className="btnrow"><span className="note">{plan.phase.label} · {plan.hours} h geplant</span>
            {week === 0 ? <Link className="btn ghost sm" href={`${base}/ziele?w=1`}>Nächste Woche →</Link> : <Link className="btn ghost sm" href={`${base}/ziele`}>← Diese Woche</Link>}</div></div>
        <div className="week">
          {plan.items.map((x) => {
            const isToday = x.day === today, changed = isToday && decision && decision.planned && decision.title !== x.title && decision.title !== `Heute: ${x.title}`;
            return (
              <div key={x.day} className={`wd t-${x.type}${isToday ? " today" : ""}${x.day < today ? " past" : ""}`}>
                <div className="wd-h"><b>{DAYS[x.dow]}</b><span className="note">{short(x.day)}</span><span className={`tag ${TYPE[x.type]?.[1] || ""}`}>{TYPE[x.type]?.[0] || x.type}</span></div>
                <div className="wd-t">{x.title}{x.min ? <span className="note"> · {x.min} min</span> : null}</div>
                <p>{x.detail}</p>
                {x.second && <div className="wd-2"><b>+ {x.second.title}</b><span className="note"> · {x.second.min} min</span><p>{x.second.detail}</p></div>}
                {(x.focus || x.focus2 || x.second?.focus) && <span className="focus">Fokus: {[...new Set([x.focus, x.focus2, x.second?.focus].filter(Boolean))].map((f) => WEAKNESSES[f]?.[0]).join(" + ")}</span>}
                {changed && <span className="adj">Heute angepasst: {decision.title}</span>}
                {x.custom && <span className="mine">{x.recurring ? "Fester Termin" : "Von dir angepasst"}</span>}
                {x.capped != null && <span className="mine">Nur {x.capped} min Zeit</span>}
                {x.moved && <span className="adj">Nachgeholt von {DAYS[(new Date(x.moved + "T12:00:00Z").getUTCDay() + 6) % 7]}</span>}
                {x.movedTo && <span className="adj">Verschoben auf {DAYS[(new Date(x.movedTo + "T12:00:00Z").getUTCDay() + 6) % 7]}</span>}
                {x.dropped && <span className="mine">Fällt diese Woche weg – kein Platz mit genug Erholung</span>}
                {!ro && x.day >= today && x.type !== "race" && <DayEditor item={x} label={`${DAYNAMES[x.dow]}, ${short(x.day)}`} action={savePlanDay} autoOpen={sp?.d === x.day || (sp?.d === "today" && isToday)}
                  others={plan.items.filter((o) => o.day >= today && o.day !== x.day && o.type !== "race").map((o) => ({ day: o.day, label: `${DAYNAMES[o.dow]} ${short(o.day)}`, title: o.title }))} />}
              </div>
            );
          })}
        </div>
        {!ro && (
          <div className="planadj" id="anpassen">
            <p className="note">Formstand schlägt vor, du passt an: bei jedem Tag auf <b>Anpassen</b> – anders trainieren (z. B. mit Buddy), Tage tauschen, nur begrenzt Zeit oder Ruhetag. Der Rest der Woche wird automatisch neu verteilt.</p>
            {(goals.fixed || []).length > 0 && (<>
              <h3>Feste Termine</h3>
              <ul className="list">{goals.fixed.map((f) => (
                <li key={f.id}><span className="tag next">jeden {DAYNAMES[f.dow]}</span><span>{f.kind === "off" ? "Keine Zeit" : f.kind === "max" ? `Nur ${f.min} min` : `${f.title} · ${f.min} min`}</span>
                  <form action={deleteFixed}><input type="hidden" name="id" value={f.id} /><button className="x" type="submit" aria-label="Festen Termin löschen">✕</button></form></li>
              ))}</ul>
            </>)}
          </div>
        )}
        {!m.hasGoals && <p className="note">Noch ein Standardplan. Trag unten Wettkämpfe, Schwächen und dein Zeitbudget ein, dann wird er persönlich.</p>}
      </section>

      <section className="grid2e">
        <div className="panel">
          <h2 id="wettkampf">Wettkämpfe</h2>
          {(goals.events || []).length ? (
            <ul className="list evs">{goals.events.map((e) => (
              <li key={e.id} className={e.date < today ? "past" : ""}><span className={`tag ${e.priority === "A" ? "on" : e.priority === "B" ? "next" : ""}`}>{e.priority}</span>
                <span><b>{e.name}</b><small className="note" style={{ display: "block" }}>{fmt(e.date)} · {EVENT_TYPES[e.type]?.[0]}{e.place ? ` · ${e.place}` : ""}{e.target ? ` · Ziel: ${e.target}` : ""}{e.date >= today ? ` · in ${Math.round((new Date(e.date) - new Date(today)) / 864e5)} Tagen` : ""}</small>
                  {(e.info || e.points?.length > 0) && <details className="evd"><summary>Details</summary>{e.info && <p>{e.info}</p>}{e.points?.length > 0 && <ul className="evpts">{e.points.map((p) => <li key={p}>{p}</li>)}</ul>}{e.url && <a href={e.url} target="_blank" rel="noreferrer">Offizielle Seite ↗</a>}</details>}</span>
                {!ro && <form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form>}</li>
            ))}</ul>
          ) : <div className="empty">Noch kein Wettkampf. Mit einem A-Wettkampf plant Formstand Aufbau, Tapering und Erholung automatisch.</div>}
          {!ro && <EventFinder addEvent={addEvent} findEvent={findEvent} aiOn={await aiReady()} today={today}
            types={Object.fromEntries(Object.entries(EVENT_TYPES).map(([k, [n]]) => [k, n]))} weakNames={Object.fromEntries(Object.entries(WEAKNESSES).map(([k, [n]]) => [k, n]))} />}
          <p className="note">A: voller Aufbau mit 2 Wochen Tapering und 6 Tagen Erholung. B: kurze Vorbereitung, 2 Tage Erholung. C: läuft als Trainingseinheit mit.</p>
        </div>

        <div className="panel">
          <h2 id="ziele">Fokus, Schwächen & Zeit</h2>
          <FitnessWork fp={fp} goalsWeak={weak} adopt={adoptWeaknesses} ro={ro} base={base} link />
          <ActionForm action={saveGoals} className="stack goalform" submit="Speichern" reset={false}>
            <div className="f"><span className="lbl">Hauptziel</span>
              <div className="chips">{Object.entries(FOCUS).map(([k, [n, d]]) => <label key={k} title={d}><input type="radio" name="focus" value={k} defaultChecked={goals.focus === k} /><span>{n}</span></label>)}</div></div>
            <div className="f"><span className="lbl">Wo willst du besser werden? <small className="note">bis 4 auswählen</small></span>
              <div className="chips">{Object.entries(WEAKNESSES).map(([k, [n, d]]) => <label key={k} title={d}><input type="checkbox" name="weak" value={k} defaultChecked={weak.includes(k)} /><span>{n}</span></label>)}</div></div>
            <label className="f">Wichtigste Schwäche (bekommt die meisten Einheiten)
              <select name="mainWeakness" defaultValue={goals.mainWeakness || ""}><option value="">automatisch: erste Auswahl</option>{Object.entries(WEAKNESSES).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <div className="form">
              <label className="f">Trainingstage pro Woche<select name="daysPerWeek" defaultValue={goals.daysPerWeek}>{[2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="f">Stunden pro Woche<input type="number" name="hoursPerWeek" min="2" max="25" step="0.5" defaultValue={goals.hoursPerWeek} /></label>
              <label className="f">Tag für die lange Einheit<select name="longDay" defaultValue={goals.longDay}>{DAYNAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
            </div>
            <p className="note">Die lange Einheit ist die längste ruhige Ausfahrt bzw. der lange Lauf der Woche (Grundlage, 1,5–4 h) – meist am Wochenende, wenn du am meisten Zeit hast. Trainingstage und Stunden sind dein Rahmen; Formstand verteilt darin harte, lockere und Krafteinheiten.</p>
            <div className="form">
              <label className="f">Zielgewicht kg<input type="number" name="targetWeight" step="0.1" min="35" max="200" defaultValue={goals.targetWeight ?? ""} placeholder="optional" /></label>
              <label className="f">Ziel-Körperfett %<input type="number" name="targetBodyfat" step="0.1" min="4" max="45" defaultValue={goals.targetBodyfat ?? ""} placeholder="optional" /></label>
              <label className="f">Tempo (Abnehmen)<select name="rate" defaultValue={goals.rate}><option value="0.25">sanft · 0,25 %/Woche</option><option value="0.5">normal · 0,5 %/Woche</option><option value="0.75">zügig · 0,75 %/Woche</option><option value="1">maximal · 1 %/Woche</option></select></label>
            </div>
            <label className="f">Schwimmeinheiten pro Woche (Triathlon)<select name="swimsPerWeek" defaultValue={goals.swimsPerWeek ?? ""}><option value="">automatisch nach Phase</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="f">Was dir sonst wichtig ist (liest die KI mit) <Dictate target="goalnote" /><textarea id="goalnote" name="note" rows={2} maxLength={500} defaultValue={goals.note || ""} placeholder="z. B. am Berg verliere ich immer den Anschluss; Knie links empfindlich" /></label>
          </ActionForm>
        </div>
      </section>

      <section className="grid2e">
        <div className="panel">
          <div className="panel-head"><h2>Rückblick</h2><span className="note">kommt montags auch als Push</span></div>
          {[[`Letzte Woche (${short(lw.from)}–${short(lw.to)})`, lw], [`${monthName[0].toUpperCase() + monthName.slice(1)}`, lm]].map(([label, p]) => (
            <div key={label} className="rv">
              <b>{label}</b>
              <div className="rv-g">
                <span><em>{p.hours} h</em>Training{p.prevHours != null ? ` (Ø ${p.prevHours})` : ""}</span>
                <span><em>{p.quality}×</em>hart · {p.strength}× Kraft</span>
                <span><em>{p.adherence ?? "–"} %</em>Plan-Treue</span>
                <span><em>{p.focus}/{p.focusPlan}</em>Fokus-Einheiten</span>
                <span><em>{p.score != null ? Math.round(p.score) : "–"}</em>Ø Bereitschaft</span>
                <span><em>{p.alc}</em>Alkohol-Abende</span>
              </div>
              {p.off.length > 0 && <p className="note">Härter als empfohlen: {p.off.map((o) => `${short(o.day)} (${o.rec} → ${o.did})`).join(", ")}</p>}
            </div>
          ))}
          <div className="rv"><b>Intensität 4 Wochen</b><p className="note">{iv.lines[0]} <Link href={`${base}/entwicklung`}>Details</Link></p></div>
          <div className="rv"><b>Diese Woche</b><p className="note">{plan.phase.label} · {plan.hours} h geplant · {plan.items.filter((x) => x.type === "quality").map((x) => x.title).join(", ") || "keine harten Einheiten"}{plan.items.some((x) => x.type === "race") ? ` · Wettkampf: ${plan.items.find((x) => x.type === "race").title.replace("Wettkampf: ", "")}` : ""}</p></div>
        </div>
        {showBody ? (
          <div className="panel">
            <div className="panel-head"><h2 id="koerperziel">Körperziel</h2><span className="note">{FOCUS[goals.focus][0]}</span></div>
            <div className="hl ctx">
              <div className="hli"><span>Gewicht (Ø 7 Tage)</span><b>{body.now ?? "–"}<small className="note"> kg</small></b>{goals.targetWeight && <small className="note">Ziel {goals.targetWeight} kg · noch {body.now != null ? Math.abs(Math.round((body.now - goals.targetWeight) * 10) / 10) : "–"} kg</small>}</div>
              <div className="hli"><span>Trend 4 Wochen</span><b>{body.slope != null ? `${body.slope > 0 ? "+" : ""}${body.slope}` : "–"}<small className="note"> kg/Woche</small></b>{body.pct != null && <small className="note">{body.pct > 0 ? "+" : ""}{body.pct} % pro Woche</small>}</div>
              {body.eta && <div className="hli"><span>Ziel erreicht etwa</span><b>{fmt(body.eta)}</b><small className="note">in ~{body.weeks} Wochen beim jetzigen Tempo</small></div>}
              {body.bfNow != null && <div className="hli"><span>Körperfett</span><b>{body.bfNow}<small className="note"> %</small></b>{goals.targetBodyfat && <small className="note">Ziel {goals.targetBodyfat} %</small>}</div>}
              {decision?.nutrition && <div className="hli"><span>Heute essen</span><b>{fmtRange(range(decision.nutrition.kcal))}<small className="note"> kcal</small></b><small className="note">{decision.nutrition.protein_g} g Protein · {decision.nutrition.carbs_g} g KH · {decision.nutrition.fat_g} g Fett</small></div>}
            </div>
            {body.warnings.map((w) => <div key={w} className="notice warn" style={{ marginTop: 8 }}>{w}</div>)}
            {decision?.nutrition?.note && <p className="note">{decision.nutrition.note}</p>}
            <p className="note">Defizit nur an lockeren Tagen, nie in Aufbau-Spitzen oder vor Wettkämpfen. Bedarf aus deinem Grundumsatz (InBody, sonst geschätzt) plus Training.</p>
          </div>
        ) : (
          <div className="panel"><h2>Körperziel</h2><p className="muted">Für Abnehmen oder Muskelaufbau oben das Hauptziel wählen und optional Zielgewicht oder Körperfett eintragen. Dann passt Formstand Kalorien und Makros täglich an.</p></div>
        )}
      </section>

      {weak.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Fokus-Fortschritt</h2><span className="note">letzte 4 Wochen Fokus-Einheiten · Kennzahl über 90 Tage</span></div>
          <div className="trig">{weak.map((w, idx) => {
            const done = sum.focusDone[w] || 0, planned = sum.focusPlanned[w] || 0, met = metricFor(w);
            return (
              <div key={w} className="card">
                <div className="t">{WEAKNESSES[w][0]}{idx === 0 && <span className="tag on">Hauptschwäche</span>}{fp.areas[w] && <span className="tag">{fp.areas[w].level}</span>}</div>
                <p>{WEAKNESSES[w][1]}</p>
                <div className="pbar"><i style={{ width: `${planned ? Math.min(100, (done / planned) * 100) : 0}%` }} /></div>
                <p><b>{done}</b> von {planned} geplanten Fokus-Einheiten umgesetzt</p>
                {met && <p>{met}</p>}
                {testFor(w) && <p>{testFor(w)}</p>}
              </div>
            );
          })}</div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Hat es funktioniert?</h2><span className="note">Empfehlung vs. tatsächliches Training · letzte {sum.n} Tage</span></div>
        <div className="hl ctx">
          <div className="hli"><span>Plan-Treue</span><b>{sum.adherence ?? "–"}<small className="note"> %</small></b><small className="note">gefolgt = 1, teilweise = ½</small></div>
          {sum.followedNext != null && <div className="hli"><span>Bereitschaft am Folgetag</span><b>{Math.round(sum.followedNext)}<small className="note"> vs. {Math.round(sum.otherNext)}</small></b><em className={sum.followedNext >= sum.otherNext ? "up" : "down"}>{sum.followedNext >= sum.otherNext ? "+" : ""}{Math.round(sum.followedNext - sum.otherNext)} Pkt., wenn du der Empfehlung gefolgt bist</em></div>}
          {sum.harderDelta != null && <div className="hli"><span>Härter als empfohlen</span><b>{sum.harderDelta > 0 ? "+" : ""}{Math.round(sum.harderDelta)}<small className="note"> Pkt.</small></b><small className="note">Bereitschaft am Morgen danach ({sum.nH}×)</small></div>}
        </div>
        {rows.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Tag</th><th>Empfohlen</th><th>Gemacht</th><th>Status</th><th className="r">Bereitschaft danach</th></tr></thead>
            <tbody>{rows.slice(-14).reverse().map((r) => (
              <tr key={r.day}>
                <td className="num">{short(r.day)}</td>
                <td>{r.rec.title}{r.rec.focus ? <span className="src">{WEAKNESSES[r.rec.focus]?.[0]}</span> : null}</td>
                <td>{ACT_LABEL[r.act.kind]}{r.act.min ? <span className="note"> · {r.act.min} min</span> : null}</td>
                <td><span className={`tag ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td>
                <td className="r num">{r.scoreNext ?? "–"}{r.scoreNext != null && r.scoreToday != null ? <span className="note"> ({r.scoreNext - r.scoreToday >= 0 ? "+" : ""}{r.scoreNext - r.scoreToday})</span> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Sobald ein paar Wochen Daten da sind, siehst du hier, ob die Empfehlungen gewirkt haben.</div>}
        <p className="note">Die Empfehlung jedes Tages wird mit dem Wissensstand jenes Morgens nachgerechnet und mit deinem tatsächlichen Training verglichen.</p>
      </section>
    </>
  );
}
