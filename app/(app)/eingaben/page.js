import { viewerAndSubject } from "@/lib/subject";
import * as repo from "@/lib/repo";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import { TEST_TYPES, TRIGGERS, triggerName, POWER_ZONES, HR_ZONES, SPORTS } from "@/lib/catalog";
import { addManual, deleteManual, updateProfile } from "../../actions-data";
import { INBODY_FIELDS } from "@/lib/ai";
import { analyzeTriggers } from "@/lib/triggers";
import ActionForm from "@/components/ActionForm";

const KIND = { inbody: "InBody", weight: "Gewicht", bodyfat: "Körperfett", trigger: "Trigger", test: "Leistungstest", note: "Notiz" };
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export default async function Eingaben() {
  const { subject } = await viewerAndSubject();
  const today = todayIso();
  const allMan = (await repo.getManual(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const entries = allMan.slice(0, 60);
  const tests = allMan.filter((e) => e.kind === "test");
  const ftp = tests.find((t) => TEST_TYPES[t.data?.test]?.ftp), lt = tests.find((t) => TEST_TYPES[t.data?.test]?.hr);
  const kg = Number(subject.weight_kg) || null;

  // Persönliche Trigger-Auswertung (12 Monate)
  const { all, activities } = await buildSeries(subject.id, addDays(today, -364), today);
  const trig = analyzeTriggers(all, activities);

  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Eingaben</h1><p>Alles, was keine Schnittstelle liefert. Wird getrennt von den API-Daten gespeichert, mit Datum und Autor.</p></div></div>

      <section className="grid3">
        <div className="panel">
          <h2>Gewicht &amp; Körperfett</h2>
          <ActionForm action={addManual}>
            <input type="hidden" name="kind" value="weight" />
            <label className="f">Datum<input type="date" name="day" defaultValue={today} max={today} /></label>
            <label className="f">Gewicht kg<input type="number" name="value" step="0.1" min="30" max="250" required /></label>
          </ActionForm>
          <ActionForm action={addManual}>
            <input type="hidden" name="kind" value="bodyfat" />
            <label className="f">Datum<input type="date" name="day" defaultValue={today} max={today} /></label>
            <label className="f">Körperfett %<input type="number" name="value" step="0.1" min="3" max="60" required /></label>
          </ActionForm>
          <p className="note">InBody-Blatt lieber unter „Bilder &amp; Dokumente“ hochladen, damit das Original erhalten bleibt.</p>
        </div>
        <div className="panel">
          <h2>Trigger</h2>
          <ActionForm action={addManual}>
            <input type="hidden" name="kind" value="trigger" />
            <label className="f">Datum (Abend)<input type="date" name="day" defaultValue={today} max={today} /></label>
            <label className="f">Trigger<select name="t" defaultValue="alkohol">{TRIGGERS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label className="f">Menge<input type="number" name="value" min="1" max="20" defaultValue="1" /></label>
          </ActionForm>
          <p className="note">Wie dein Körper am Morgen danach reagiert, steht unten unter „Deine Trigger“.</p>
        </div>
        <div className="panel">
          <h2>Profil</h2>
          <ActionForm action={updateProfile} reset={false}>
            <label className="f">Sportart<select name="sport" defaultValue={subject.sport || ""}><option value="">–</option>{SPORTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="f">Gewicht kg<input type="number" name="weight_kg" step="0.1" defaultValue={subject.weight_kg ?? ""} /></label>
            <label className="f">Jahrgang<input type="number" name="birth_year" min="1930" max="2020" defaultValue={subject.birth_year ?? ""} /></label>
          </ActionForm>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Deine Trigger · was sie bei dir bewirken</h2><span className="note">Morgen danach vs. Morgen ohne Trigger am gleichen Wochentag · 12 Monate</span></div>
        {trig.length ? <div className="trig">{trig.map((r) => {
          const M = r.metrics, f = (m, dec = 0, unit = "") => (m?.diff == null || m.n < 3 ? null : `${m.diff > 0 ? "+" : "−"}${Math.abs(m.diff).toFixed(dec)}${unit}`);
          const rows = [["HRV", f(M.hrv, 0, " %"), M.hrv, 1], ["Ruhepuls", f(M.rhr, 1, " bpm"), M.rhr, -1], ["Sleep Score", f(M.sleepScore, 0, " Pkt."), M.sleepScore, 1], ["Schlaf", f(M.sleep, 0, " min"), M.sleep, 1], ["Tagesform", f(M.score, 0, " Pkt."), M.score, 1]].filter((x) => x[1]);
          return (
            <div key={r.k} className={`card tcard lv-${r.level.replace(/ /g, "-")}`}>
              <div className="t">{r.name}<span className="tag">{r.count}×</span></div>
              {rows.length ? <ul>{rows.map(([n, v, m, dir]) => <li key={n}><span>{n}</span><b className={m.level === "kein klarer Effekt" ? "" : dir * m.diff < 0 ? "down" : "up"}>{v}</b></li>)}</ul> : <p>Noch keine Recovery-Daten zu diesen Abenden.</p>}
              {r.recovery != null && r.recovery >= 0.3 && (r.level === "ziemlich sicher" || r.level === "Tendenz") && <p>Erholung: HRV im Schnitt nach <b>{r.recovery.toFixed(1)} Tagen</b> wieder normal ({r.recoveryN} Fälle)</p>}
              {M.hrv?.doseLo != null && M.hrv?.doseHi != null && <p>Dosis: 1–2 Gl. HRV {M.hrv.doseLo > 0 ? "+" : "−"}{Math.abs(Math.round(M.hrv.doseLo))} % · 3+ Gl. {M.hrv.doseHi > 0 ? "+" : "−"}{Math.abs(Math.round(M.hrv.doseHi))} %</p>}
              <p className="lv">{r.level}</p>
            </div>
          );
        })}</div> : <div className="empty">Noch keine Trigger eingetragen. Trage z. B. Alkohol am Abend ein, nach einigen Wochen siehst du hier, was er bei dir bewirkt.</div>}
        <p className="note">„Ziemlich sicher“ heisst: deutlicher Effekt über viele Abende. „Tendenz“: Richtung erkennbar, aber noch unsicher. „Training spät abends“ erkennt Formstand automatisch (Start nach 19 Uhr).</p>
      </section>

      <section className="grid2e">
        <div className="panel">
          <h2>Leistungstest eintragen</h2>
          <ActionForm action={addManual}>
            <input type="hidden" name="kind" value="test" />
            <label className="f">Test<select name="test">{Object.entries(TEST_TYPES).map(([k, t]) => <option key={k} value={k}>{t.name} · {t.label}</option>)}</select></label>
            <label className="f">Datum<input type="date" name="day" defaultValue={today} max={today} /></label>
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
          {ftp && <p className="note">Nächster FTP-Test fällig: {fmt(addDays(ftp.day, 7 * (TEST_TYPES[ftp.data.test]?.wks || 8)))}</p>}
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
                <td className="num">{e.kind === "inbody" ? (e.data?.inbody_score != null ? `Score ${e.data.inbody_score}` : "") : e.value == null ? "" : Number(e.value)}{e.kind === "inbody" ? "" : e.kind === "weight" ? " kg" : e.kind === "bodyfat" ? " %" : e.kind === "test" ? ` ${TEST_TYPES[e.data?.test]?.unit || ""}` : e.kind === "trigger" && e.data?.t === "alkohol" ? " Gl." : ""}</td>
                <td className="wrap">{e.kind === "inbody" ? ["smm_kg", "fat_mass_kg", "body_fat_pct", "visceral_level"].filter((f) => e.data?.[f] != null).map((f) => `${INBODY_FIELDS[f][0]} ${e.data[f]}${INBODY_FIELDS[f][1] ? " " + INBODY_FIELDS[f][1] : ""}`).join(" · ") : e.kind === "trigger" ? triggerName(e.data?.t) : e.kind === "test" ? `${TEST_TYPES[e.data?.test]?.name || e.data?.test}${e.data?.note ? " · " + e.data.note : ""}` : e.data?.text || ""}</td>
                <td><form action={deleteManual}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Eingaben.</div>}
      </section>
    </>
  );
}
