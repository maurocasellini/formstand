import Link from "next/link";
import { viewerAndSubject } from "@/lib/subject";
import { todayModel } from "@/lib/coach";
import { weekPlan, mondayOf, DAYS, PHASES } from "@/lib/plan";
import { review, summarize, ACT_LABEL } from "@/lib/adherence";
import { changes } from "@/lib/insights";
import * as repo from "@/lib/repo";
import { FOCUS, EVENT_TYPES, WEAKNESSES } from "@/lib/catalog";
import { saveGoals, addEvent, deleteEvent } from "../../actions-data";
import ActionForm from "@/components/ActionForm";

export const maxDuration = 60;
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const short = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const addD = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TYPE = { rest: ["Ruhe", "none"], easy: ["Locker", "warn"], long: ["Lang", "next"], quality: ["Qualität", "on"], strength: ["Kraft", "str"], race: ["Wettkampf", "race"], opener: ["Aktivierung", "warn"], endurance: ["Grundlage", "warn"], recovery: ["Erholung", "none"] };
const STATUS = { gefolgt: ["✓ gefolgt", "on"], teilweise: ["~ teilweise", "wait"], anders: ["↑ härter", "err"], ausgelassen: ["– ausgelassen", ""] };
const DAYNAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export default async function Ziele({ searchParams }) {
  const sp = await searchParams;
  const { subject, viewer } = await viewerAndSubject();
  const m = await todayModel(subject.id);
  const { goals, today, all, zones, decision, phase } = m;
  const week = sp?.w === "1" ? 1 : 0;
  const plan = weekPlan(goals, addD(mondayOf(today), 7 * week), m.user || {}, zones);
  const rows = review(all, { ...m.ctx, goals: m.hasGoals ? goals : null }, 28);
  const sum = summarize(rows);
  const manual = await repo.getManual(subject.id);
  const ch = Object.fromEntries(changes(all, { focus: goals.focus, manual }).map((c) => [c.key, c]));
  const weak = [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean);
  const nextA = (goals.events || []).find((e) => e.priority === "A" && e.date >= today);
  const ro = viewer.demo;

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
        <div className="panel-head"><h2>Wochenplan</h2>
          <div className="btnrow"><span className="note">{plan.phase.label} · {plan.hours} h geplant</span>
            {week === 0 ? <Link className="btn ghost sm" href="/ziele?w=1">Nächste Woche →</Link> : <Link className="btn ghost sm" href="/ziele">← Diese Woche</Link>}</div></div>
        <div className="week">
          {plan.items.map((x) => {
            const isToday = x.day === today, changed = isToday && decision && decision.planned && decision.title !== x.title && decision.title !== `Heute: ${x.title}`;
            return (
              <div key={x.day} className={`wd t-${x.type}${isToday ? " today" : ""}${x.day < today ? " past" : ""}`}>
                <div className="wd-h"><b>{DAYS[x.dow]}</b><span className="note">{short(x.day)}</span><span className={`tag ${TYPE[x.type]?.[1] || ""}`}>{TYPE[x.type]?.[0] || x.type}</span></div>
                <div className="wd-t">{x.title}{x.min ? <span className="note"> · {x.min} min</span> : null}</div>
                <p>{x.detail}</p>
                {(x.focus || x.focus2) && <span className="focus">Fokus: {[x.focus, x.focus2].filter(Boolean).map((f) => WEAKNESSES[f]?.[0]).join(" + ")}</span>}
                {changed && <span className="adj">Heute angepasst: {decision.title}</span>}
              </div>
            );
          })}
        </div>
        {!m.hasGoals && <p className="note">Noch ein Standardplan. Trag unten Wettkämpfe, Schwächen und dein Zeitbudget ein, dann wird er persönlich.</p>}
      </section>

      <section className="grid2e">
        <div className="panel">
          <h2>Wettkämpfe</h2>
          {(goals.events || []).length ? (
            <ul className="list evs">{goals.events.map((e) => (
              <li key={e.id} className={e.date < today ? "past" : ""}><span className={`tag ${e.priority === "A" ? "on" : e.priority === "B" ? "next" : ""}`}>{e.priority}</span>
                <span><b>{e.name}</b><small className="note" style={{ display: "block" }}>{fmt(e.date)} · {EVENT_TYPES[e.type]?.[0]}{e.target ? ` · Ziel: ${e.target}` : ""}{e.date >= today ? ` · in ${Math.round((new Date(e.date) - new Date(today)) / 864e5)} Tagen` : ""}</small></span>
                {!ro && <form action={deleteEvent}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form>}</li>
            ))}</ul>
          ) : <div className="empty">Noch kein Wettkampf. Mit einem A-Wettkampf plant Formstand Aufbau, Tapering und Erholung automatisch.</div>}
          {!ro && (
            <ActionForm action={addEvent} className="stack" submit="Wettkampf eintragen">
              <div className="form">
                <label className="f">Name<input type="text" name="name" required placeholder="z. B. Engadiner, Zürich Marathon" /></label>
                <label className="f">Datum<input type="date" name="date" required min={today} /></label>
              </div>
              <div className="form">
                <label className="f">Art<select name="type" defaultValue="rad_marathon">{Object.entries(EVENT_TYPES).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select></label>
                <label className="f">Priorität<select name="priority" defaultValue="A"><option value="A">A – Saisonhöhepunkt</option><option value="B">B – wichtig</option><option value="C">C – Training</option></select></label>
              </div>
              <label className="f">Ziel (optional)<input type="text" name="target" maxLength={120} placeholder="z. B. unter 5 h, Top 20 %, durchkommen" /></label>
            </ActionForm>
          )}
          <p className="note">A: voller Aufbau mit 2 Wochen Tapering und 6 Tagen Erholung. B: kurze Vorbereitung, 2 Tage Erholung. C: läuft als Trainingseinheit mit.</p>
        </div>

        <div className="panel">
          <h2>Fokus, Schwächen & Zeit</h2>
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
              <label className="f">Langer Tag<select name="longDay" defaultValue={goals.longDay}>{DAYNAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
            </div>
            <label className="f">Was dir sonst wichtig ist (liest die KI mit)<textarea name="note" rows={2} maxLength={500} defaultValue={goals.note || ""} placeholder="z. B. am Berg verliere ich immer den Anschluss; Knie links empfindlich" /></label>
          </ActionForm>
        </div>
      </section>

      {weak.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Fokus-Fortschritt</h2><span className="note">letzte 4 Wochen Fokus-Einheiten · Kennzahl über 90 Tage</span></div>
          <div className="trig">{weak.map((w, idx) => {
            const done = sum.focusDone[w] || 0, planned = sum.focusPlanned[w] || 0, met = metricFor(w);
            return (
              <div key={w} className="card">
                <div className="t">{WEAKNESSES[w][0]}{idx === 0 && <span className="tag on">Hauptschwäche</span>}</div>
                <p>{WEAKNESSES[w][1]}</p>
                <div className="bar"><i style={{ width: `${planned ? Math.min(100, (done / planned) * 100) : 0}%` }} /></div>
                <p><b>{done}</b> von {planned} geplanten Fokus-Einheiten umgesetzt</p>
                {met && <p>{met}</p>}
              </div>
            );
          })}</div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Hat es funktioniert?</h2><span className="note">Empfehlung vs. tatsächliches Training · letzte {sum.n} Tage</span></div>
        <div className="hl ctx">
          <div className="hli"><span>Plan-Treue</span><b>{sum.adherence ?? "–"}<small className="note"> %</small></b><small className="note">gefolgt = 1, teilweise = ½</small></div>
          {sum.followedNext != null && <div className="hli"><span>Tagesform am Folgetag</span><b>{Math.round(sum.followedNext)}<small className="note"> vs. {Math.round(sum.otherNext)}</small></b><em className={sum.followedNext >= sum.otherNext ? "up" : "down"}>{sum.followedNext >= sum.otherNext ? "+" : ""}{Math.round(sum.followedNext - sum.otherNext)} Pkt., wenn du der Empfehlung gefolgt bist</em></div>}
          {sum.harderDelta != null && <div className="hli"><span>Härter als empfohlen</span><b>{sum.harderDelta > 0 ? "+" : ""}{Math.round(sum.harderDelta)}<small className="note"> Pkt.</small></b><small className="note">Tagesform am Morgen danach ({sum.nH}×)</small></div>}
        </div>
        {rows.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Tag</th><th>Empfohlen</th><th>Gemacht</th><th>Status</th><th className="r">Tagesform danach</th></tr></thead>
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
