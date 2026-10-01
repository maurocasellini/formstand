import { pageContext } from "@/lib/subject";
import DateField from "@/components/DateField";
import * as repo from "@/lib/repo";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import { TEST_TYPES, TEST_GROUPS, TEST_DURATIONS, testText, TRIGGERS, triggerName, POWER_ZONES, HR_ZONES, SPORTS, SWIM_ZONES, pace } from "@/lib/catalog";
import TestForm from "@/components/TestForm";
import FitnessProfile from "@/components/FitnessProfile";
import { fitnessProfile } from "@/lib/fitness";
import { vo2Summary } from "@/lib/vo2";
import Vo2Card from "@/components/Vo2Card";
import { addManual, deleteManual, updateProfile, addWorkout, deleteWorkout, saveEvening, saveEveningGrid, uploadMedia, adoptWeaknesses } from "../../actions-data";
import FilePick from "@/components/FilePick";
import { aiReady } from "@/lib/ai";
import EveningForm from "@/components/EveningForm";
import { eveningMap } from "@/lib/evening";
import { INBODY_FIELDS } from "@/lib/ai";
import { analyzeTriggers, analyzePairs, pairLine } from "@/lib/triggers";
import ActionForm from "@/components/ActionForm";

const KIND = { inbody: "InBody", weight: "Gewicht", bodyfat: "Körperfett", trigger: "Einflussfaktor", test: "Leistungstest", note: "Notiz" };
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export default async function Tests({ demo } = {}) {
  const { subject, viewer, base } = await pageContext(demo);
  const today = todayIso();
  const ai = await aiReady();
  const allMan = (await repo.getManual(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const eve = eveningMap(allMan, addDays(today, -400));
  const gridDays = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const FACTORS = TRIGGERS.filter(([k]) => k !== "alkohol");
  const entries = allMan.slice(0, 60);
  const tests = allMan.filter((e) => e.kind === "test");
  const ftp = tests.find((t) => TEST_TYPES[t.data?.test]?.ftp), lt = tests.find((t) => TEST_TYPES[t.data?.test]?.hr), css = tests.find((t) => TEST_TYPES[t.data?.test]?.css);
  const wLast = allMan.find((e) => e.kind === "weight");
  const kg = (wLast ? Number(wLast.value) : Number(subject.weight_kg)) || null;
  const goals = await repo.getGoals(subject.id);
  const goalsWeak = [goals.mainWeakness, ...(goals.weaknesses || [])].filter(Boolean);
  const { all, activities } = await buildSeries(subject.id, addDays(today, -400), today);
  const vo2 = vo2Summary(all, allMan, subject, today);
  const fp = fitnessProfile(allMan, { sex: subject.sex, kg, goals, profile: subject, today, vo2 });
  // Für den Client nur, was das Formular braucht
  const formTypes = Object.fromEntries(Object.entries(TEST_TYPES).map(([k, t]) => [k, { group: t.group, fmt: t.fmt, dur: Boolean(t.dur), name: t.name, label: t.label, desc: t.desc, unit: t.unit, dist: t.dist || null, per: t.per || null }]));
  const own = (await repo.getActivities(subject.id)).filter((a) => a.provider === "manual").sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 8);

  // Persönliche Trigger-Auswertung (12 Monate)

  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Tests</h1><p>Ausdauer-Diagnostik, Maximalkraft, Lauf & Rudern, Grundlagenfitness – eintragen oder hochladen. Daraus rechnet Formstand Zonen, Arbeitsgewichte, dein Fitness-Profil und den Fortschritt deiner Ziele.</p></div></div>

      <nav className="subnav" aria-label="Abschnitte"><a href="#test">Eintragen</a><a href="#zonen">Zonen</a><a href="#vo2">VO2max</a><a href="#fitness">Fitness-Profil</a><a href="#wirkung">Wofür Tests?</a><a href="#verlauf">Alle Tests</a></nav>

      <section className="grid2e">
        <div className="panel">
          <h2 id="test">Test eintragen</h2>
          <TestForm action={addManual} types={formTypes} groups={TEST_GROUPS} durations={TEST_DURATIONS} today={today} start={fp.tests.length || !ftp ? "kraft" : "diagnostik"} />
          {!viewer.demo && (
            <details className="stack">
              <summary className="note" style={{ cursor: "pointer", fontWeight: 600 }}>Oder Screenshot/PDF hochladen – die KI liest die Werte aus</summary>
              <ActionForm action={uploadMedia} className="stack" submit="Hochladen & auslesen" busy="Liest aus… (ca. 15 s)">
                <input type="hidden" name="kind" value="test" />
                <FilePick name="file" accept="image/*,application/pdf" multiple hint="Zwift, Garmin, Laborbericht, Concept2, Strava, Notizen mit Kraftwerten …" />
                <input type="hidden" name="day" value={today} />
              </ActionForm>
              <p className="note">{ai ? "Testart, Datum und Werte werden ausgelesen – ein Bericht kann mehrere Werte liefern. Die Datei bleibt unter Körper → Dokumente." : "Automatisches Auslesen braucht die KI (Admin → Schnittstellen)."}</p>
            </details>
          )}
        </div>
        <div className="panel">
          <h2 id="zonen">{ftp ? `Rad-Zonen · FTP ${Number(ftp.value)} W${kg ? ` · ${(Number(ftp.value) / kg).toFixed(1)} W/kg` : ""}` : "Zonen"}</h2>
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
        <div className="panel-head"><h2 id="vo2">VO2max</h2><span className="note">deine maximale Sauerstoffaufnahme – der wichtigste Einzelwert für Ausdauer und Gesundheit</span></div>
        {vo2 ? <Vo2Card v={vo2} /> : <div className="empty">Noch keine VO2max-Werte. Garmin schätzt sie aus Läufen und Rad mit Wattmesser und schickt sie über intervals.icu (Wellness-Daten erlauben). Oder oben einen VO2max-Wert aus Labor oder Uhr als Test eintragen.</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 id="fitness">Fitness-Profil</h2><span className="note">Kraft, Lauf & Rudern, Grundlagenfitness – eingestuft und mit deinen Zielen verknüpft</span></div>
        {fp.tests.length ? <FitnessProfile fp={fp} goalsWeak={goalsWeak} adopt={adoptWeaknesses} setSex={updateProfile} ro={viewer.demo} />
          : <div className="empty">Noch keine Kraft- oder Fitnesstests. Ein guter Start-Check (ca. 60 min, an 1–2 Tagen): Kniebeuge und Bankdrücken mit 3–5 Wiederholungen, Kreuzheben, 1 km Lauf oder 2000 m Rudern, 5 min Burpees, Plank und Klimmzüge. Formstand stuft jede Leistung ein und schlägt vor, woran wir arbeiten.</div>}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 id="wirkung">Wo die Tests überall einfliessen</h2></div>
        <div className="cards">
          <div className="card"><div className="t">Zonen & Tagesvorgaben</div><p>FTP, Schwellenpuls und CSS ergeben die Watt-, Puls- und Pace-Bereiche – in jeder Einheit des Wochenplans und in der Entscheidung für heute. Alte oder unsichere Tests werden markiert.</p></div>
          <div className="card"><div className="t">Arbeitsgewichte</div><p>Aus Krafttests (1–5 Wdh.) schätzt Formstand das 1RM und schreibt in die Krafteinheiten konkrete Gewichte, z. B. „Kniebeuge 4×5 @ 100 kg“.</p></div>
          <div className="card"><div className="t">Woran wir arbeiten</div><p>Das Fitness-Profil zeigt deine schwächsten Bereiche. Übernommen in die Ziele, setzt der Wochenplan Fokus-Einheiten dafür.</p></div>
          <div className="card"><div className="t">Messbare Ziele</div><p>Ziele wie „Kniebeuge 140 kg“ oder „5 km unter 21:30“ messen ihren Fortschritt an deinen Tests – auf der Übersicht siehst du, ob du auf Kurs bist.</p></div>
          <div className="card"><div className="t">KI-Empfehlungen</div><p>Tagesempfehlung und Körperanalyse kennen deine Testwerte und Stufen und beziehen sich darauf.</p></div>
          <div className="card"><div className="t">Belastung</div><p>Mit FTP und Schwellenpuls wird die Trainingslast von Einheiten ohne Wattmesser genauer geschätzt.</p></div>
        </div>
        <p className="note">Wann neu testen? Bei jedem Test steht, wann er fällig ist (meist alle 6–10 Wochen). Am besten ausgeruht, nach einem lockeren Tag, immer unter ähnlichen Bedingungen.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 id="verlauf">Alle Tests</h2><span className="note">{tests.length} Einträge</span></div>
        {tests.length ? (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Datum</th><th>Test</th><th>Ergebnis</th><th>Notiz</th><th></th></tr></thead>
            <tbody>{tests.map((e) => (
              <tr key={e.id}>
                <td className="num">{fmt(e.day)}</td>
                <td>{TEST_TYPES[e.data?.test]?.name || e.data?.test}{e.source_media && <span className="src">aus Datei</span>}</td>
                <td className="num">{testText(e.data?.test, e.value, e.data)}</td>
                <td className="wrap">{e.data?.note || ""}</td>
                <td><form action={deleteManual}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Tests.</div>}
      </section>
    </>
  );
}
