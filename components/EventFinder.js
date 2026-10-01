"use client";
import { useState, useTransition } from "react";
import ActionForm from "./ActionForm";
import DateField, { nice } from "./DateField";

// Wettkampf eintragen: erst suchen lassen (KI mit Websuche), Kategorie wählen, dann mit vorausgefüllten Feldern speichern.
export default function EventFinder({ addEvent, findEvent, aiOn, today, types, weakNames }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [variant, setVariant] = useState(null);
  const [n, setN] = useState(0); // erzwingt neue Startwerte im Formular
  const [pending, start] = useTransition();

  const search = () => start(async () => {
    setErr(null);
    const r = await findEvent(q);
    if (r?.error) { setErr(r.error); return; }
    setRes(r.result); setVariant(r.result.variants.length === 1 ? r.result.variants[0].name : null); setN((x) => x + 1);
  });
  const reset = () => { setRes(null); setVariant(null); setQ(""); setErr(null); setN((x) => x + 1); };
  const fullName = res ? (variant && !res.name.toLowerCase().includes(variant.toLowerCase()) ? `${res.name} – ${variant}` : res.name) : "";
  const needsVariant = res && res.variants.length > 1 && !variant;

  return (
    <div className="stack">
      {aiOn && (
        <div className="evsearch">
          <label className="f">Wettkampf suchen
            <span className="evsearch-row">
              <input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (q.trim().length > 2) search(); } }} placeholder="z. B. ATHX St. Gallen, Engadiner Sommerlauf" maxLength={120} />
              <button type="button" className="btn" onClick={search} disabled={pending || q.trim().length < 3}>{pending ? "Sucht…" : "Suchen"}</button>
            </span>
          </label>
          {pending && <p className="note">Formstand sucht den Wettkampf im Web und ordnet ihn ein (ca. 10–20 Sekunden).</p>}
          {err && <div className="notice crit">{err}</div>}
        </div>
      )}

      {res && (
        <div className={`evres${res.found ? "" : " miss"}`}>
          <div className="evres-h">
            <b>{res.found ? res.name : `Nicht sicher gefunden: ${res.name}`}</b>
            <button type="button" className="x" onClick={reset} aria-label="Suche verwerfen">✕</button>
          </div>
          <p className="note">{[res.place, res.date ? `${nice(res.date)}${res.dateSure ? "" : " (Datum unsicher – bitte prüfen)"}` : "Datum nicht gefunden", types[res.type]].filter(Boolean).join(" · ")}{!res.searched && " · ohne Websuche, bitte prüfen"}</p>
          {res.info && <p>{res.info}</p>}
          {res.variants.length > 1 && (
            <div className="f"><span className="lbl">{res.question || "Welche Kategorie startest du?"}</span>
              <div className="vchips">{res.variants.map((v) => (
                <button type="button" key={v.name} className={`vchip${variant === v.name ? " on" : ""}`} onClick={() => { setVariant(v.name); setN((x) => x + 1); }}>
                  <b>{v.name}</b>{v.text && <span>{v.text}</span>}
                </button>
              ))}</div></div>
          )}
          {res.variants.length <= 1 && res.question && <p className="note"><b>Rückfrage:</b> {res.question}</p>}
          {res.points.length > 0 && <div><span className="lbl">Darauf kommt es im Training an</span><ul className="evpts">{res.points.map((p) => <li key={p}>{p}</li>)}</ul></div>}
          {res.url && <a className="note" href={res.url} target="_blank" rel="noreferrer">Offizielle Seite ↗</a>}
        </div>
      )}

      <ActionForm key={n} action={async (prev, fd) => { if (needsVariant) return { error: "Bitte zuerst oben die Kategorie wählen." }; const r = await addEvent(prev, fd); if (r?.ok) setTimeout(reset, 1200); return r; }} className="stack" submit={needsVariant ? "Erst Kategorie wählen" : "Wettkampf eintragen"}>
        {res && <>
          <input type="hidden" name="variant" value={variant || ""} />
          <input type="hidden" name="info" value={res.info || ""} />
          <input type="hidden" name="place" value={res.place || ""} />
          <input type="hidden" name="url" value={res.url || ""} />
          <input type="hidden" name="points" value={JSON.stringify(res.points)} />
          <input type="hidden" name="weak" value={res.weak.join(",")} />
        </>}
        <div className="form">
          <label className="f">Name<input type="text" name="name" required defaultValue={fullName} placeholder="z. B. Engadiner, Zürich Marathon" /></label>
          <label className="f">Datum<DateField name="date" required min={today} defaultValue={res?.date || ""} /></label>
        </div>
        <div className="form">
          <label className="f">Art<select name="type" defaultValue={res?.type || "rad_marathon"}>{Object.entries(types).map(([k, name]) => <option key={k} value={k}>{name}</option>)}</select></label>
          <label className="f">Priorität<select name="priority" defaultValue="A"><option value="A">A – Saisonhöhepunkt</option><option value="B">B – wichtig</option><option value="C">C – Training</option></select></label>
        </div>
        <label className="f">Ziel (optional)<input type="text" name="target" maxLength={120} placeholder="z. B. unter 5 h, Top 20 %, durchkommen" /></label>
        {res?.weak?.length > 0 && <label className="chk-l"><input type="checkbox" name="takeWeak" value="1" /> Passende Schwerpunkte übernehmen: {res.weak.map((w) => weakNames[w]).join(", ")}</label>}
      </ActionForm>
    </div>
  );
}
