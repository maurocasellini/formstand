import Link from "next/link";
import ActionForm from "./ActionForm";
import { WEAKNESSES } from "@/lib/catalog";

const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const TONE = { "sehr gut": "good", gut: "good", stabil: "", gemischt: "warn", "rückläufig": "crit" };

// Entwicklung über die Zeit: Bewertung, Text, konkrete Veränderungen
export function Development({ e, short = false }) {
  if (!e) return null;
  return (
    <div className={`ba-dev ${TONE[e.bewertung] || ""}`}>
      <div className="ba-dev-h"><span className="lbl">Entwicklung{e.seit ? ` seit ${fmt(e.seit)}` : ""}</span><b>{e.bewertung}</b></div>
      <p>{e.text}</p>
      {!short && e.punkte?.length > 0 && <ul>{e.punkte.map((x) => <li key={x}>{x}</li>)}</ul>}
    </div>
  );
}

// Körperanalyse aus Fotos: Einschätzung, Stärken, Potenzial, Trainingsfokus – mit Übernahme in die Ziele
export default function BodyAnalysis({ a, measured, ro, adopt, compact = false }) {
  if (!a) return null;
  const weak = (a.schwaechen || []).filter((k) => WEAKNESSES[k]);
  if (compact) return (
    <div className="ba compact">
      <p><b>{a.zusammenfassung}</b></p>
      <Development e={a.entwicklung} short />
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
      <Development e={a.entwicklung} />
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
      <p className="note">Analyse vom {fmt(a.day)}{a.basis ? ` · Grundlage: ${a.basis}` : ` aus ${a.photos?.length || 0} Foto${a.photos?.length === 1 ? "" : "s"}`} · ein Eindruck, keine Messung; InBody ist genauer.</p>
    </div>
  );
}
