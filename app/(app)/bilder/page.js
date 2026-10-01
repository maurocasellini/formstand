import Link from "next/link";
import { pageContext } from "@/lib/subject";
import DateField from "@/components/DateField";
import * as repo from "@/lib/repo";
import { todayIso } from "@/lib/metrics";
import { MEDIA_KINDS } from "@/lib/catalog";
import { uploadMedia, deleteMedia, rereadInBody, comparePhotos, changeMedia } from "../../actions-data";
import CompareSlider from "@/components/CompareSlider";
import { filesReady } from "@/lib/files";
import { aiReady } from "@/lib/ai";
import ActionForm from "@/components/ActionForm";

export const maxDuration = 60;
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const POSE = { front: "Front", side: "Seite", back: "Rücken" };
const CHANGE_TONE = { definierter: "up", "weniger Fett": "up", "mehr Masse": "up", weicher: "down" };
const d1 = (v) => (v == null ? "–" : Number(v).toFixed(1));
// Kennzahlen aus InBody: [Name, Feld, Einheit, Richtung (+1 = mehr ist besser, −1 = weniger ist besser, 0 = neutral)]
const KPIS = [["Gewicht", "weight_kg", " kg", 0], ["Skelettmuskelmasse", "smm_kg", " kg", 1], ["Fettmasse", "fat_mass_kg", " kg", -1], ["Körperfett", "body_fat_pct", " %", -1], ["Viszeralfett", "visceral_level", "", -1]];
const CARD_VALS = [["Gewicht", "weight_kg", "kg"], ["Muskelmasse", "smm_kg", "kg"], ["Fettmasse", "fat_mass_kg", "kg"], ["Körperfett", "body_fat_pct", "%"], ["Viszeralfett", "visceral_level", ""], ["Grundumsatz", "bmr_kcal", "kcal"]];

// Datei-Aktionen: Art/Pose korrigieren, neu auslesen, löschen
function FileTools({ m, ai, ro }) {
  if (ro) return null;
  return (
    <details className="ftools"><summary>Datei bearbeiten</summary>
      <ActionForm action={changeMedia} className="form" submit="Ändern" reset={false}>
        <input type="hidden" name="id" value={m.id} />
        <label className="f">Art<select name="kind" defaultValue={m.kind}>{Object.entries(MEDIA_KINDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label className="f">Pose<select name="pose" defaultValue={m.pose || "front"}><option value="front">Front</option><option value="side">Seite</option><option value="back">Rücken</option></select></label>
      </ActionForm>
      <div className="btnrow">
        {m.kind === "inbody" && ai && <ActionForm action={rereadInBody} className="btnrow" submit={m.extracted ? "Neu auslesen" : "Werte auslesen"} busy="Liest…" reset={false}><input type="hidden" name="id" value={m.id} /></ActionForm>}
        <form action={deleteMedia}><input type="hidden" name="id" value={m.id} /><button className="btn danger sm" type="submit">Löschen</button></form>
      </div>
    </details>
  );
}

export default async function Bilder({ searchParams, demo } = {}) {
  const sp = await searchParams;
  const { subject, viewer, base } = await pageContext(demo);
  const ro = Boolean(viewer.demo);
  const media = (await repo.getMedia(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const ai = await aiReady();
  const manual = await repo.getManual(subject.id);

  // InBody-Messungen (aufsteigend) und Kennzahlen seit der ersten Messung
  const ib = manual.filter((m) => m.kind === "inbody").sort((a, b) => (a.day < b.day ? -1 : 1));
  const first = ib[0]?.data, last = ib[ib.length - 1]?.data;
  const delta = (k) => (first && last && first[k] != null && last[k] != null && ib.length > 1 ? last[k] - first[k] : null);

  // Gemeinsames Raster: eine Karte pro Datum mit Körperfotos und InBody-Werten
  const photos = media.filter((m) => m.kind === "body_photo");
  const sheets = media.filter((m) => m.kind === "inbody");
  const cards = new Map();
  const card = (day) => { if (!cards.has(day)) cards.set(day, { day, photos: [], inbody: null, sheets: [] }); return cards.get(day); };
  for (const p of photos) card(p.day).photos.push(p);
  for (const e of ib) card(e.day).inbody = e;
  for (const s of sheets) { const e = ib.find((x) => x.source_media === s.id); card(e ? e.day : s.day).sheets.push(s); }
  const timeline = [...cards.values()].sort((a, b) => (a.day < b.day ? 1 : -1));

  // Vorher/Nachher: Pose wählen, Standard neuestes Foto vs. ca. 8 Wochen davor
  const asc = [...photos].sort((a, b) => (a.day < b.day ? -1 : 1));
  const poses = [...new Set(asc.map((p) => p.pose || "none"))];
  const pose = sp?.pose && poses.includes(sp.pose) ? sp.pose : poses.includes("front") ? "front" : poses[0];
  const list = asc.filter((p) => (p.pose || "none") === pose);
  const B = list.find((p) => p.id === sp?.b) || list[list.length - 1];
  const target = B ? new Date(new Date(B.day).getTime() - 56 * 864e5) : null;
  const A = list.find((p) => p.id === sp?.a) || (B ? [...list].filter((p) => p.id !== B.id && p.day < B.day).sort((x, y) => Math.abs(new Date(x.day) - target) - Math.abs(new Date(y.day) - target))[0] : null);
  const cmp = A && B ? (await repo.getPhotoCompares(subject.id))[`${A.id}|${B.id}`] : null;
  const days = A && B ? Math.round((new Date(B.day) - new Date(A.day)) / 864e5) : 0;

  const docs = media.filter((m) => !["body_photo", "inbody"].includes(m.kind));
  const docGroups = ["blood", "meal", "other"].map((k) => [k, docs.filter((m) => m.kind === k)]).filter(([, l]) => l.length);

  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Körper</h1><p>InBody-Messungen, Körperfotos und deine Entwicklung an einem Ort. Privat gespeichert, nur über dein Konto abrufbar.</p></div></div>

      <nav className="subnav" aria-label="Abschnitte">
        {!ro && <a href="#hinzufuegen">Hinzufügen</a>}<a href="#verlauf">Entwicklung</a>{photos.length > 1 && <a href="#vergleich">Vorher / Nachher</a>}{docs.length > 0 && <a href="#dokumente">Dokumente</a>}
      </nav>

      {!ro && (
        <section className="panel">
          <h2 id="hinzufuegen">Hinzufügen</h2>
          {!filesReady && <div className="notice warn">Der Dateispeicher ist noch nicht verbunden.</div>}
          <ActionForm action={uploadMedia} submit="Hochladen" busy="Lädt und erkennt…">
            <label className="f fwide">Dateien (Bild oder PDF, max. 4 MB, bis 6 auf einmal)<input type="file" name="file" accept="image/*,application/pdf" multiple required /></label>
            <label className="f">Datum<DateField name="day" defaultValue={todayIso()} max={todayIso()} /></label>
            <label className="f">Art<select name="kind" defaultValue={MEDIA_KINDS[sp?.art] ? sp.art : "auto"}>
              <option value="auto">{ai ? "Automatisch erkennen" : "Automatisch (Bild = Körperfoto)"}</option>{Object.entries(MEDIA_KINDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label className="f">Notiz<input type="text" name="note" maxLength={200} placeholder="z. B. nüchtern, morgens" /></label>
          </ActionForm>
          <p className="note">{ai
            ? "Formstand erkennt selbst, was du hochlädst: Körperfoto (inkl. Front, Seite, Rücken), InBody- oder Waagen-Auswertung (Werte werden automatisch ausgelesen), Laborbefund oder Mahlzeit. Dafür wird die Datei kurz an Claude geschickt (ca. 0,2 Rappen). Wer das nicht will, wählt die Art selbst."
            : "Ohne KI wird ein Bild als Körperfoto abgelegt; die Art lässt sich wählen und später ändern."}</p>
          <details className="note"><summary>Tipps für gute Körperfotos</summary>Alle 2–4 Wochen, morgens nüchtern, gleiches Licht, gleicher Abstand, Kamera auf Hüfthöhe, entspannt stehen. Front, Seite und Rücken. Gewicht ohne InBody trägst du unter <Link href={`${base}/eingaben#gewicht`}>Eingaben</Link> ein.</details>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2 id="verlauf">Körperentwicklung</h2><span className="note">{ib.length} InBody-Messungen · {photos.length} Körperfotos</span></div>
        {ib.length > 1 && (
          <div className="hl ctx">
            {KPIS.map(([n, k, u, dir]) => {
              const dv = delta(k); if (dv == null) return null;
              return <div key={k} className="hli"><span>{n}</span><b>{d1(last[k])}<small className="note">{u}</small></b><em className={dir === 0 || Math.abs(dv) < 0.05 ? "" : dir * dv > 0 ? "up" : "down"}>{dv > 0 ? "+" : ""}{d1(dv)}{u} seit {fmt(ib[0].day)}</em></div>;
            })}
          </div>
        )}
        {timeline.length ? (
          <div className="kgrid">
            {timeline.map((c) => (
              <article key={c.day} className="kcard">
                <header><b>{fmt(c.day)}</b>{c.inbody && <span className="tag on">InBody</span>}{c.photos.length > 0 && <span className="tag next">{c.photos.length} {c.photos.length === 1 ? "Foto" : "Fotos"}</span>}</header>
                {c.photos.length > 0 && (
                  <div className="kph">{c.photos.map((p) => (
                    <figure key={p.id}>
                      <a href={`/api/media/${p.id}`} target="_blank" rel="noreferrer"><img src={`/api/media/${p.id}`} alt={`Körperfoto ${POSE[p.pose] || ""} vom ${fmt(p.day)}`} loading="lazy" /></a>
                      <figcaption>{POSE[p.pose] || "ohne Pose"}</figcaption>
                      <FileTools m={p} ai={ai} ro={ro} />
                    </figure>
                  ))}</div>
                )}
                {c.inbody?.data && (
                  <dl className="kvals">{CARD_VALS.filter(([, k]) => c.inbody.data[k] != null).map(([n, k, u]) => <div key={k}><dt>{n}</dt><dd>{k === "visceral_level" || k === "bmr_kcal" ? c.inbody.data[k] : d1(c.inbody.data[k])}{u && <small> {u}</small>}</dd></div>)}</dl>
                )}
                {c.sheets.map((s) => (
                  <div key={s.id} className="ksheet">
                    <a href={`/api/media/${s.id}`} target="_blank" rel="noreferrer" className="note">{s.content_type === "application/pdf" ? "InBody-Blatt (PDF) öffnen" : "InBody-Blatt öffnen"} ↗</a>
                    {s.extract_error && <p className="note" style={{ color: "var(--crit)" }}>{s.extract_error}</p>}
                    {!s.extracted && !s.extract_error && <p className="note">{ai ? "Noch nicht ausgelesen." : "Auslesen braucht die KI (Admin → Schnittstellen)."}</p>}
                    <FileTools m={s} ai={ai} ro={ro} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : <div className="empty">Noch keine Messungen oder Fotos. Lade oben ein InBody-Blatt oder ein Körperfoto hoch – Formstand ordnet es selbst ein.</div>}
      </section>

      {photos.length > 0 && (
        <section className="panel pcmp">
          <div className="panel-head"><h2 id="vergleich">Vorher / Nachher</h2>{poses.length > 1 && <div className="btnrow">{poses.map((p) => <a key={p} className={`btn sm ${p === pose ? "" : "ghost"}`} href={`${base}/bilder?pose=${p}#vergleich`}>{POSE[p] || "Ohne Pose"}</a>)}</div>}</div>
          {A && B ? (
            <>
              <form className="form" method="get" action={`${base}/bilder#vergleich`}>
                <input type="hidden" name="pose" value={pose} />
                <label className="f">Vorher<select name="a" defaultValue={A.id}>{list.map((p) => <option key={p.id} value={p.id}>{fmt(p.day)}</option>)}</select></label>
                <label className="f">Nachher<select name="b" defaultValue={B.id}>{list.map((p) => <option key={p.id} value={p.id}>{fmt(p.day)}</option>)}</select></label>
                <button className="btn ghost" type="submit">Anzeigen</button>
              </form>
              <div className="grid2e">
                <CompareSlider a={`/api/media/${A.id}`} b={`/api/media/${B.id}`} labelA={fmt(A.day)} labelB={fmt(B.day)} />
                <div className="pres">
                  <p className="note">{days} Tage dazwischen.</p>
                  {cmp ? (
                    <>
                      <p><b>{cmp.zusammenfassung}</b></p>
                      <ul className="list">{cmp.regionen.map((r, i) => <li key={i} style={{ gridTemplateColumns: "110px 1fr" }}><span className={`tag ${CHANGE_TONE[r.veraenderung] === "up" ? "on" : CHANGE_TONE[r.veraenderung] === "down" ? "wait" : ""}`}>{r.region}</span><span><b>{r.veraenderung}</b> · {r.beschreibung}</span></li>)}</ul>
                      {(cmp.kf_a || cmp.kf_b) && <p className="note">Körperfett grob geschätzt: {cmp.kf_a ? `${cmp.kf_a[0]}–${cmp.kf_a[1]} %` : "–"} → {cmp.kf_b ? `${cmp.kf_b[0]}–${cmp.kf_b[1]} %` : "–"}. Nur ein Eindruck (±3–4 %); die InBody-Messung ist genauer.</p>}
                      <p className="note">Vergleichbarkeit der Fotos: {cmp.vergleichbarkeit}{cmp.foto_hinweise.length ? ` – ${cmp.foto_hinweise.join(" · ")}` : ""}</p>
                    </>
                  ) : <p className="muted">Schieb den Regler, um Vorher und Nachher zu überblenden.{ai ? " Die KI kann die sichtbaren Veränderungen zusätzlich beschreiben." : ""}</p>}
                  {ai && !ro && (
                    <ActionForm action={comparePhotos} className="btnrow" submit={cmp ? "Neu vergleichen" : "Mit KI vergleichen"} busy="Vergleicht…" reset={false}>
                      <input type="hidden" name="a" value={A.id} /><input type="hidden" name="b" value={B.id} />
                    </ActionForm>
                  )}
                  {ai && <p className="note">Die beiden Fotos werden nur auf Knopfdruck an Claude geschickt (ca. 1–2 Rappen).</p>}
                </div>
              </div>
            </>
          ) : <p className="muted">Für einen Vergleich braucht es mindestens zwei Fotos in derselben Pose.</p>}
        </section>
      )}

      {docGroups.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2 id="dokumente">Weitere Dokumente</h2><span className="note">Laborbefunde, Mahlzeiten, Sonstiges</span></div>
          {docGroups.map(([k, l]) => (
            <div key={k} className="stack">
              <h3>{MEDIA_KINDS[k]} · {l.length}</h3>
              <div className="gallery">
                {l.map((m) => (
                  <figure key={m.id}>
                    <a href={`/api/media/${m.id}`} target="_blank" rel="noreferrer">
                      {m.content_type?.startsWith("image/") ? <img src={`/api/media/${m.id}`} alt={`${MEDIA_KINDS[k]} vom ${fmt(m.day)}`} loading="lazy" /> : <div className="doc">PDF</div>}
                    </a>
                    <figcaption><span>{fmt(m.day)}{m.note ? ` · ${m.note}` : ""}</span></figcaption>
                    <FileTools m={m} ai={ai} ro={ro} />
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
