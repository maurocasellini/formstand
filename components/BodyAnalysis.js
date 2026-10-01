import Link from "next/link";
import ActionForm from "./ActionForm";
import { WEAKNESSES } from "@/lib/catalog";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;

// Körperanalyse aus Fotos: Einschätzung, Stärken, Potenzial, Trainingsfokus – mit Übernahme in die Ziele
export default function BodyAnalysis({ a, measured, ai, ro, analyze, adopt, compact = false, base = "" }) {
  if (!a) return null;
  const weak = (a.schwaechen || []).filter((k) => WEAKNESSES[k]);
  if (compact) return (
    <div className="ba compact">
      <p><b>{a.zusammenfassung}</b></p>
      <div className="ba-cols">
        {a.kf && <div className="ba-kf"><span>Körperfett geschätzt</span><b>{a.kf[0]}–{a.kf[1]} %</b>{measured != null && <small>gemessen {measured} %</small>}</div>}
        {a.defizite?.length > 0 && <div><span className="lbl">Potenzial</span><ul>{a.defizite.slice(0, 2).map((x) => <li key={x}>{x}</li>)}</ul></div>}
        {a.training?.[0] && <div><span className="lbl">Trainingsfokus</span><p><b>{a.training[0].titel}</b> – {a.training[0].warum}</p></div>}
      </div>
    </div>
  );
  return (
    <div className="ba">
      <p className="ba-sum">{a.zusammenfassung}</p>
      <div className="ba-top">
        {a.kf && <div className="ba-kf"><span>Körperfett geschätzt</span><b>{a.kf[0]}–{a.kf[1]} %</b><small>Sicherheit {a.kf_sicherheit}{measured != null ? ` · gemessen (InBody/Waage) ${measured} %` : ""}</small></div>}
        <div className="ba-list good"><span className="lbl">Das ist gut</span><ul>{a.staerken.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="ba-list warn"><span className="lbl">Hier liegt Potenzial</span><ul>{a.defizite.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      {a.regionen?.length > 0 && <div className="ba-reg">{a.regionen.map((r) => <span key={r.region} className={r.fokus ? "on" : ""} title={r.einschaetzung}><b>{r.region}</b>{r.einschaetzung}</span>)}</div>}
      {a.training?.length > 0 && (
        <div className="ba-train"><span className="lbl">So richtest du das Training darauf aus</span>
          <div className="ba-tc">{a.training.map((t) => <div key={t.titel}><b>{t.titel}</b><p className="note">{t.warum}</p><p>{t.wie}</p></div>)}</div>
        </div>
      )}
      {a.ernaehrung && <p><b>Ernährung:</b> {a.ernaehrung}</p>}
      {weak.length > 0 && !ro && (
        <ActionForm action={adopt} className="btnrow ba-adopt" submit="In meine Ziele übernehmen" reset={false}>
          <input type="hidden" name="weak" value={weak.join(",")} />
          <span>Vorschlag für den Wochenplan: <b>{weak.map((k) => WEAKNESSES[k][0]).join(", ")}</b></span>
        </ActionForm>
      )}
      {a.foto_hinweise?.length > 0 && <p className="note">Für bessere Fotos: {a.foto_hinweise.join(" · ")}</p>}
      <div className="btnrow">
        <span className="note">Einschätzung vom {fmt(a.day)} aus {a.photos?.length || 0} Foto{a.photos?.length === 1 ? "" : "s"} · ein Eindruck, keine Messung; InBody ist genauer.</span>
        {ai && !ro && <ActionForm action={analyze} className="btnrow" submit="Neu analysieren" busy="Analysiert… (ca. 20 s)" reset={false}><input type="hidden" name="day" value={a.day} /></ActionForm>}
      </div>
    </div>
  );
}
