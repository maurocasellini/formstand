import Link from "next/link";
import ActionForm from "./ActionForm";
import { TEST_GROUPS, WEAKNESSES } from "@/lib/catalog";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const Lvl = ({ s, label }) => (
  <span className="lvl-t"><span className="lvl" title={`Stufe ${s?.toFixed(1)} von 5`}><i style={{ width: `${Math.max(4, Math.min(100, ((s || 0) / 5) * 100))}%` }} /></span>{label && <small>{label}</small>}</span>
);

// Woran wir arbeiten: schwächste Bereiche aus den Tests, mit Übernahme in die Ziele
export function FitnessWork({ fp, goalsWeak = [], adopt, ro, base = "", link = false }) {
  if (!fp?.suggest?.length) return null;
  const add = fp.suggest.map((a) => a.area).filter((k) => WEAKNESSES[k] && !goalsWeak.includes(k));
  return (
    <div className="fp-work">
      <b>Aus deinen Tests: daran arbeiten wir</b>
      <ul>{fp.suggest.map((a) => <li key={a.area}><b>{a.name}</b> – {a.level} ({a.tests.map((x) => `${x.name} ${x.text}`).join(", ")}){a.relevant ? " · wichtig für dein Ziel" : ""}{goalsWeak.includes(a.area) ? " · ist schon in deinen Zielen" : ""}</li>)}</ul>
      {fp.strong.length > 0 && <p className="note">Stärken: {fp.strong.map((a) => `${a.name} (${a.level})`).join(", ")} – hier reicht Erhaltung.</p>}
      {add.length > 0 && !ro && adopt && (
        <ActionForm action={adopt} className="btnrow" submit="In meine Ziele übernehmen" reset={false}>
          <input type="hidden" name="weak" value={add.join(",")} />
          <span className="note">Der Wochenplan setzt dann Fokus-Einheiten dafür (max. 4 Schwächen).</span>
        </ActionForm>
      )}
      {link && <Link className="note" href={`${base}/eingaben#fitness`}>Alle Tests und Stufen →</Link>}
    </div>
  );
}

export default function FitnessProfile({ fp, goalsWeak, adopt, setSex, ro }) {
  const groups = ["kraft", "lauf", "fitness"].map((g) => [g, fp.tests.filter((t) => t.group === g)]).filter(([, l]) => l.length);
  return (
    <div className="stack">
      <div className="btnrow" style={{ justifyContent: "space-between" }}>
        <p><b>Gesamtstufe: {fp.overall}</b> <span className="note">· Stufen: Einsteiger → Grundlage → Fortgeschritten → Stark → Elite. Kraft relativ zum Körpergewicht{fp.kg ? ` (${fp.kg} kg)` : " – Gewicht fehlt, unter Körper eintragen"}.</span></p>
        {!ro && (
          <ActionForm action={setSex} className="btnrow" submit="Ändern" reset={false}>
            <label className="f" style={{ minWidth: 0 }}>Normen für<select name="sex" defaultValue={fp.sexAssumed ? "" : fp.sex}><option value="" disabled>bitte wählen</option><option value="m">Männer</option><option value="w">Frauen</option></select></label>
          </ActionForm>
        )}
      </div>
      {fp.sexAssumed && <div className="notice warn">Noch kein Geschlecht hinterlegt – Formstand bewertet vorerst mit den Normen für Männer.</div>}
      <div className="fp-areas">{Object.values(fp.areas).sort((a, b) => a.score - b.score).map((a) => (
        <div key={a.area} className={`fp-area ${fp.suggest.some((x) => x.area === a.area) ? "weak" : fp.strong.some((x) => x.area === a.area) ? "strong" : ""}`}>
          <div className="row"><b>{a.name}</b><small>{a.level}</small></div>
          <Lvl s={a.score} />
          <small>{a.tests.map((x) => x.name).join(", ")}</small>
        </div>
      ))}</div>
      <FitnessWork fp={fp} goalsWeak={goalsWeak} adopt={adopt} ro={ro} />
      {groups.map(([g, l]) => (
        <div key={g} className="stack">
          <h3>{TEST_GROUPS[g][0]}</h3>
          <div className="tbl-wrap"><table>
            <thead><tr><th>Test</th><th>Ergebnis</th><th>Stufe</th><th>Entwicklung</th><th>Datum</th></tr></thead>
            <tbody>{l.map((t) => (
              <tr key={t.key}>
                <td>{t.name}</td>
                <td className="num">{t.text}{t.extra && <><br /><small className="note">{t.extra}</small></>}</td>
                <td><Lvl s={t.score} label={t.level} /></td>
                <td className="wrap">{t.prev ? <><span className={`delta ${t.delta > 0.05 ? "up" : t.delta < -0.05 ? "down" : ""}`}>{t.delta > 0.05 ? "besser" : t.delta < -0.05 ? "schlechter" : "gleich"}</span> <small className="note">vorher {t.prev.text} ({fmt(t.prev.day)})</small></> : <small className="note">erster Test</small>}</td>
                <td className="num">{fmt(t.day)}{t.due && <><br /><small className="note" style={{ color: "var(--warn-ink)" }}>neuer Test fällig</small></>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ))}
    </div>
  );
}
