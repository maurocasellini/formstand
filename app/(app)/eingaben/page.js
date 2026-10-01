import { pageContext } from "@/lib/subject";
import DateField from "@/components/DateField";
import * as repo from "@/lib/repo";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import { TEST_TYPES, TRIGGERS, triggerName, POWER_ZONES, HR_ZONES, SPORTS, SWIM_ZONES, pace } from "@/lib/catalog";
import { addManual, deleteManual, updateProfile, addWorkout, deleteWorkout, saveEvening, saveEveningGrid } from "../../actions-data";
import EveningForm from "@/components/EveningForm";
import { eveningMap } from "@/lib/evening";
import { INBODY_FIELDS } from "@/lib/ai";
import { analyzeTriggers, analyzePairs, pairLine } from "@/lib/triggers";
import ActionForm from "@/components/ActionForm";

const KIND = { inbody: "InBody", weight: "Gewicht", bodyfat: "Körperfett", trigger: "Einflussfaktor", test: "Leistungstest", note: "Notiz" };
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export default async function Eingaben({ demo } = {}) {
  const { subject, viewer, base } = await pageContext(demo);
  const today = todayIso();
  const allMan = (await repo.getManual(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const eve = eveningMap(allMan, addDays(today, -400));
  const gridDays = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const FACTORS = TRIGGERS.filter(([k]) => k !== "alkohol");
  const entries = allMan.slice(0, 60);
  const tests = allMan.filter((e) => e.kind === "test");
  const ftp = tests.find((t) => TEST_TYPES[t.data?.test]?.ftp), lt = tests.find((t) => TEST_TYPES[t.data?.test]?.hr), css = tests.find((t) => TEST_TYPES[t.data?.test]?.css);
  const kg = Number(subject.weight_kg) || null;
  const own = (await repo.getActivities(subject.id)).filter((a) => a.provider === "manual").sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 8);

  // Persönliche Trigger-Auswertung (12 Monate)
  const { all, activities } = await buildSeries(subject.id, addDays(today, -364), today);
  const trig = analyzeTriggers(all, activities);
  const pairs = analyzePairs(all, activities).filter((p) => p.stronger || p.weaker);

  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Eingaben</h1><p>Alles, was keine Schnittstelle liefert. Wird getrennt von den API-Daten gespeichert, mit Datum und Autor.</p></div></div>

      <section className="panel">
        <div className="panel-head"><h2 id="training">Training nachtragen</h2><span className="note">für Einheiten ohne Uhr – zählt für Belastung, Muskulatur und Plan-Treue</span></div>
        <ActionForm action={addWorkout} submit="Eintragen">
          <label className="f">Datum<DateField name="day" defaultValue={today} max={today} /></label>
          <label className="f">Sport<select name="sport" defaultValue="bike"><option value="bike">Rad</option><option value="run">Laufen</option><option value="swim">Schwimmen</option><option value="strength">Kraft</option><option value="hike">Wandern</option><option value="other">Anderes</option></select></label>
          <label className="f">Name<input type="text" name="title" maxLength={60} placeholder="z. B. Ausfahrt mit Buddy" /></label>
          <label className="f">Dauer min<input type="number" name="min" min="5" max="900" required /></label>
          <label className="f">Anstrengung 1–10<input type="number" name="rpe" min="1" max="10" defaultValue="6" required /></label>
          <label className="f">Bereich (Kraft)<select name="region" defaultValue="full"><option value="full">Ganzkörper</option><option value="legs">Beine</option><option value="upper">Oberkörper</option></select></label>
        </ActionForm>
        {own.length > 0 && <ul className="list">{own.map((a) => (
          <li key={a.external_id}><span className="tag">{fmt(a.day)}</span><span>{a.name} · {Math.round(a.duration_s / 60)} min</span>
            <form action={deleteWorkout}><input type="hidden" name="id" value={a.external_id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></li>
        ))}</ul>}
      </section>


      <section className="panel">
        <div className="panel-head"><h2 id="trigger">Einflussfaktoren</h2><span className="note">Alkohol und alles, was die Nacht beeinflussen kann – auch rückwirkend</span></div>
        <EveningForm entries={eve} today={today} action={saveEvening} factors={FACTORS} />
        <details className="evgrid">
          <summary>Letzte 14 Tage auf einmal nachtragen oder korrigieren</summary>
          <ActionForm action={saveEveningGrid} className="stack" submit="Alle 14 Tage speichern" reset={false}>
            <input type="hidden" name="days" value={gridDays.join(",")} />
            <div className="tbl-wrap"><table className="egrid">
              <thead><tr><th>Tag</th><th>Alkohol (Gl.)</th><th>Weitere Faktoren</th></tr></thead>
              <tbody>{gridDays.map((d) => {
                const e = eve[d] || { alc: 0, f: [] };
                return (
                  <tr key={d}>
                    <td className="num">{["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(d + "T12:00:00Z").getUTCDay()]} {d.slice(8, 10)}.{d.slice(5, 7)}.</td>
                    <td><input type="number" name={`alc_${d}`} min="0" max="20" defaultValue={e.alc || 0} style={{ width: 70 }} /></td>
                    <td><div className="chips sm">{FACTORS.map(([k, n]) => <label key={k}><input type="checkbox" name={`f_${d}`} value={k} defaultChecked={e.f.includes(k)} /><span>{n}</span></label>)}</div></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </ActionForm>
        </details>
        <p className="note">Weiter zurück? Oben ein beliebiges Datum wählen. Wie du am Morgen danach reagierst, steht gleich unten.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Deine Reaktion nach …</h2><span className="note">Morgen danach vs. vergleichbare Morgen ohne diesen Faktor (gleicher Wochentag) · 12 Monate</span></div>
        {trig.length ? <div className="trig">{trig.map((r) => {
          const M = r.metrics, f = (m, dec = 0, unit = "") => (m?.diff == null || m.n < 3 ? null : `${m.diff > 0 ? "+" : "−"}${Math.abs(m.diff).toFixed(dec)}${unit}`);
          const rows = [["HRV", f(M.hrv, 0, " %"), M.hrv, 1], ["Ruhepuls", f(M.rhr, 1, " bpm"), M.rhr, -1], ["Sleep Score", f(M.sleepScore, 0, " Pkt."), M.sleepScore, 1], ["Schlaf", f(M.sleep, 0, " min"), M.sleep, 1], ["Bereitschaft", f(M.score, 0, " Pkt."), M.score, 1]].filter((x) => x[1]);
          return (
            <div key={r.k} className={`card tcard lv-${r.level.replace(/ /g, "-")}`}>
              <div className="t">{r.name}<span className="tag">{r.derived ? "automatisch · " : ""}{r.count}×</span></div>
              {rows.length ? <ul>{rows.map(([n, v, m, dir]) => <li key={n}><span>{n}</span><b className={m.level === "kein klarer Effekt" ? "" : dir * m.diff < 0 ? "down" : "up"}>{v}</b></li>)}</ul> : <p>Noch keine Recovery-Daten zu diesen Abenden.</p>}
              {r.recovery != null && r.recovery >= 0.3 && (r.level === "ziemlich sicher" || r.level === "Tendenz") && <p>Erholung: HRV im Schnitt nach <b>{r.recovery.toFixed(1)} Tagen</b> wieder normal ({r.recoveryN} Fälle)</p>}
              {M.hrv?.doseLo != null && M.hrv?.doseHi != null && <p>Dosis: 1–2 Gl. HRV {M.hrv.doseLo > 0 ? "+" : "−"}{Math.abs(Math.round(M.hrv.doseLo))} % · 3+ Gl. {M.hrv.doseHi > 0 ? "+" : "−"}{Math.abs(Math.round(M.hrv.doseHi))} %</p>}
              <p className="lv">{r.level}</p>
            </div>
          );
        })}</div> : <div className="empty">Noch keine Faktoren eingetragen. Trage z. B. Alkohol, spätes Essen oder Mobility ein – nach einigen Wochen siehst du hier deine Reaktion am Morgen danach.</div>}
        {pairs.length > 0 && (<>
          <h3>Kombinationen</h3>
          <ul className="list">{pairs.map((p) => <li key={p.a + p.b} style={{ gridTemplateColumns: "1fr" }}><span>{pairLine(p)}</span></li>)}</ul>
        </>)}
        <p className="note">Das sind Zusammenhänge in deinen eigenen Daten, keine Beweise für Ursache und Wirkung. „Ziemlich sicher“: deutlicher Unterschied über viele Abende. „Tendenz“: Richtung erkennbar, aber noch unsicher. „Training spät abends“ (Start nach 19 Uhr) und „Harte Einheit“ erkennt Formstand automatisch. Positive Faktoren wie Mobility, Meditation oder Massage lassen sich genauso eintragen.</p>
      </section>

      <section className="grid2e">
        <div className="panel">
          <h2 id="test">Leistungstest eintragen</h2>
          <ActionForm action={addManual}>
            <input type="hidden" name="kind" value="test" />
            <label className="f">Test<select name="test">{Object.entries(TEST_TYPES).map(([k, t]) => <option key={k} value={k}>{t.name} · {t.label}</option>)}</select></label>
            <label className="f">Datum<DateField name="day" defaultValue={today} max={today} /></label>
            <label className="f">Wert<input type="number" name="value" min="1" max="2000" required /></label>
            <label className="f">Notiz<input type="text" name="note" maxLength={80} placeholder="z. B. Pace 4:45/km" /></label>
          </ActionForm>
          <div className="cards">{Object.entries(TEST_TYPES).slice(0, 5).map(([k, t]) => <div key={k} className="card"><div className="t">{t.name}</div><p>{t.desc}</p></div>)}</div>
        </div>
        <div className="panel">
          <h2>{ftp ? `Rad-Zonen · FTP ${Number(ftp.value)} W${kg ? ` · ${(Number(ftp.value) / kg).toFixed(1)} W/kg` : ""}` : "Zonen"}</h2>
          {ftp ? (
            <div className="tbl-wrap"><table><thead><tr><th>Zone</th><th className="r">% FTP</th><th className="r">Watt</th></tr></thead><tbody>
              {POWER_ZONES.map(([n, a, b]) => <tr key={n}><td>{n}</td><td className="r num">{b ? `${Math.round(a * 100)}–${Math.round(b * 100)}` : `> ${Math.round(a * 100)}`}</td><td className="r num">{b ? `${Math.round(Number(ftp.value) * a)}–${Math.round(Number(ftp.value) * b)}` : `> ${Math.round(Number(ftp.value) * a)}`}</td></tr>)}
            </tbody></table></div>
          ) : <div className="empty">Für Rad-Zonen einen FTP-Test eintragen (z. B. Zwift Ramp Test).</div>}
          {lt && (
            <div className="tbl-wrap"><table><thead><tr><th>Laufzone</th><th className="r">% Schwelle</th><th className="r">bpm (Schwelle {Number(lt.value)})</th></tr></thead><tbody>
              {HR_ZONES.map(([n, a, b]) => <tr key={n}><td>{n}</td><td className="r num">{b ? `${a ? Math.round(a * 100) : "<"}–${Math.round(b * 100)}` : `> ${Math.round(a * 100)}`}</td><td className="r num">{b ? `${a ? Math.round(Number(lt.value) * a) : "<"}–${Math.round(Number(lt.value) * b)}` : `> ${Math.round(Number(lt.value) * a)}`}</td></tr>)}
            </tbody></table></div>
          )}
          {css && (
            <div className="tbl-wrap"><table><thead><tr><th>Schwimmzone</th><th className="r">Pace /100 m (CSS {pace(Number(css.value))})</th></tr></thead><tbody>
              {SWIM_ZONES.map(([n, a, b]) => { const c = Number(css.value); return <tr key={n}><td>{n}</td><td className="r num">{a == null ? `schneller als ${pace(c + b)}` : b == null ? `langsamer als ${pace(c + a)}` : `${pace(c + a)}–${pace(c + b)}`}</td></tr>; })}
            </tbody></table></div>
          )}
          {[["FTP", ftp, "W"], ["Schwellenpuls", lt, "bpm"], ["CSS", css, "s/100 m"]].filter(([, t]) => t).map(([n, t, u]) => {
            const tt = TEST_TYPES[t.data?.test] || {}, age = Math.round((new Date(today) - new Date(t.day)) / 864e5), old = age > (tt.wks || 8) * 7;
            return <p key={n} className="note srcline"><b>{n} {Number(t.value)} {u}</b> · {tt.name} · Verlässlichkeit {old ? "gesunken (alt)" : tt.conf || "mittel"} · {age} Tage alt{old ? " – neuer Test empfohlen" : ` · nächster Test fällig ${fmt(addDays(t.day, 7 * (tt.wks || 8)))}`}</p>;
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Letzte Eingaben</h2><span className="note">{entries.length} angezeigt</span></div>
        {entries.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Datum</th><th>Art</th><th>Wert</th><th>Details</th><th></th></tr></thead>
            <tbody>{entries.map((e) => (
              <tr key={e.id}>
                <td className="num">{fmt(e.day)}</td>
                <td>{KIND[e.kind] || e.kind}{e.source_media && <span className="src">aus InBody</span>}{e.is_demo && <span className="src">Beispiel</span>}</td>
                <td className="num">{e.kind === "inbody" ? (e.data?.inbody_score != null ? `Score ${e.data.inbody_score}` : "") : e.value == null ? "" : Number(e.value)}{e.kind === "inbody" ? "" : e.kind === "weight" ? " kg" : e.kind === "bodyfat" ? " %" : e.kind === "test" ? (e.data?.test === "css" ? ` s (${pace(Number(e.value))}/100 m)` : ` ${TEST_TYPES[e.data?.test]?.unit || ""}`) : e.kind === "trigger" && e.data?.t === "alkohol" ? " Gl." : ""}</td>
                <td className="wrap">{e.kind === "inbody" ? ["smm_kg", "fat_mass_kg", "body_fat_pct", "visceral_level"].filter((f) => e.data?.[f] != null).map((f) => `${INBODY_FIELDS[f][0]} ${e.data[f]}${INBODY_FIELDS[f][1] ? " " + INBODY_FIELDS[f][1] : ""}`).join(" · ") : e.kind === "trigger" ? triggerName(e.data?.t) : e.kind === "test" ? `${TEST_TYPES[e.data?.test]?.name || e.data?.test}${e.data?.note ? " · " + e.data.note : ""}` : e.data?.text || ""}</td>
                <td><form action={deleteManual}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Eingaben.</div>}
      </section>
    </>
  );
}
