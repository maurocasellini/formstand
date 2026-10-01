import { viewerAndSubject } from "@/lib/subject";
import { q } from "@/lib/db";
import { buildSeries, todayIso, addDays } from "@/lib/metrics";
import { TEST_TYPES, TRIGGERS, triggerName, POWER_ZONES, HR_ZONES, SPORTS } from "@/lib/catalog";
import { addManual, deleteManual, updateProfile } from "../../actions-data";
import ActionForm from "@/components/ActionForm";

const KIND = { weight: "Gewicht", bodyfat: "Körperfett", trigger: "Trigger", test: "Leistungstest", note: "Notiz" };
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export default async function Eingaben() {
  const { subject } = await viewerAndSubject();
  const today = todayIso();
  const entries = await q(`select id, day::text as day, kind, value, data, is_demo from manual_entries where user_id=$1 order by day desc, id desc limit 60`, [subject.id]);
  const tests = await q(`select day::text as day, value, data from manual_entries where user_id=$1 and kind='test' order by day desc`, [subject.id]);
  const ftp = tests.find((t) => TEST_TYPES[t.data?.test]?.ftp), lt = tests.find((t) => TEST_TYPES[t.data?.test]?.hr);
  const kg = Number(subject.weight_kg) || null;

  // Wirkung der Trigger auf den nächsten Morgen (12 Monate)
  const { all } = await buildSeries(subject.id, addDays(today, -364), today);
  const scored = all.filter((d) => d.score != null && d.day >= addDays(today, -364));
  const clean = scored.filter((d) => !(d.night || []).length);
  const impact = TRIGGERS.map(([k, n]) => {
    const yes = scored.filter((d) => (d.night || []).some((t) => t.t === k));
    if (yes.length < 2 || !clean.length) return null;
    return { k, n, count: yes.length, dS: mean(yes.map((d) => d.score)) - mean(clean.map((d) => d.score)), dH: yes.every((d) => d.hrv) ? (mean(yes.map((d) => d.hrv)) / mean(clean.map((d) => d.hrv)) - 1) * 100 : null, dSl: (mean(yes.map((d) => d.sleep || 0)) - mean(clean.map((d) => d.sleep || 0))) * 60 };
  }).filter(Boolean);

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
          <h3>Wirkung am nächsten Morgen · 12 Monate</h3>
          {impact.length ? (
            <table><tbody>{impact.map((i) => (
              <tr key={i.k}><td><b>{i.n}</b> <span className="note">{i.count}×</span></td>
                <td className="r num" style={{ color: i.dS < 0 ? "var(--crit)" : "var(--good)", fontWeight: 600 }}>{i.dS > 0 ? "+" : ""}{Math.round(i.dS)} Pkt.</td>
                <td className="r num">{i.dH == null ? "" : `HRV ${i.dH > 0 ? "+" : ""}${Math.round(i.dH)} %`}</td>
                <td className="r num">{`Schlaf ${i.dSl > 0 ? "+" : ""}${Math.round(i.dSl)} min`}</td></tr>
            ))}</tbody></table>
          ) : <div className="empty">Noch zu wenige Einträge mit Recovery-Daten.</div>}
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
                <td>{KIND[e.kind] || e.kind}{e.is_demo && <span className="src">Beispiel</span>}</td>
                <td className="num">{e.value == null ? "" : Number(e.value)}{e.kind === "weight" ? " kg" : e.kind === "bodyfat" ? " %" : e.kind === "test" ? ` ${TEST_TYPES[e.data?.test]?.unit || ""}` : e.kind === "trigger" && e.data?.t === "alkohol" ? " Gl." : ""}</td>
                <td className="wrap">{e.kind === "trigger" ? triggerName(e.data?.t) : e.kind === "test" ? `${TEST_TYPES[e.data?.test]?.name || e.data?.test}${e.data?.note ? " · " + e.data.note : ""}` : e.data?.text || ""}</td>
                <td><form action={deleteManual}><input type="hidden" name="id" value={e.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></td>
              </tr>))}</tbody>
          </table></div>
        ) : <div className="empty">Noch keine Eingaben.</div>}
      </section>
    </>
  );
}
