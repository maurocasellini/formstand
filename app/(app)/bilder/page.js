import { pageContext } from "@/lib/subject";
import DateField from "@/components/DateField";
import * as repo from "@/lib/repo";
import { todayIso } from "@/lib/metrics";
import { MEDIA_KINDS } from "@/lib/catalog";
import { uploadMedia, deleteMedia, rereadInBody, comparePhotos } from "../../actions-data";
import CompareSlider from "@/components/CompareSlider";
import { filesReady } from "@/lib/files";
import { aiReady } from "@/lib/ai";
import { INBODY_FIELDS } from "@/lib/ai";
import ActionForm from "@/components/ActionForm";

export const maxDuration = 60;
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;

const POSE = { front: "Front", side: "Seite", back: "Rücken" };
const CHANGE_TONE = { definierter: "up", "weniger Fett": "up", "mehr Masse": "up", weicher: "down" };
const d1 = (v) => (v == null ? "–" : Number(v).toFixed(1));

export default async function Bilder({ searchParams, demo } = {}) {
  const sp = await searchParams;
  const { subject, viewer, base } = await pageContext(demo);
  const media = (await repo.getMedia(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const blobOk = filesReady;
  const ai = await aiReady();
  const groups = Object.keys(MEDIA_KINDS).map((k) => [k, media.filter((m) => m.kind === k)]).filter(([, l]) => l.length);

  // Körper-Fortschritt: Messungen (InBody / Körperfett / Gewicht)
  const manual = await repo.getManual(subject.id);
  const ib = manual.filter((m) => m.kind === "inbody").sort((a, b) => (a.day < b.day ? -1 : 1));
  const ibRows = ib.slice(-6).reverse();
  const first = ib[0]?.data, last = ib[ib.length - 1]?.data;
  const delta = (k) => (first && last && first[k] != null && last[k] != null && ib.length > 1 ? last[k] - first[k] : null);

  // Fotovergleich: Pose wählen, Vorher/Nachher bestimmen (Standard: neuestes vs. ca. 8 Wochen davor)
  const photos = media.filter((m) => m.kind === "body_photo").sort((a, b) => (a.day < b.day ? -1 : 1));
  const poses = [...new Set(photos.map((p) => p.pose || "none"))];
  const pose = sp?.pose && poses.includes(sp.pose) ? sp.pose : poses.includes("front") ? "front" : poses[0];
  const list = photos.filter((p) => (p.pose || "none") === pose);
  const B = list.find((p) => p.id === sp?.b) || list[list.length - 1];
  const target = B ? new Date(new Date(B.day).getTime() - 56 * 864e5) : null;
  const A = list.find((p) => p.id === sp?.a) || (B ? [...list].filter((p) => p.id !== B.id && p.day < B.day).sort((x, y) => Math.abs(new Date(x.day) - target) - Math.abs(new Date(y.day) - target))[0] : null);
  const cmp = A && B ? (await repo.getPhotoCompares(subject.id))[`${A.id}|${B.id}`] : null;
  const days = A && B ? Math.round((new Date(B.day) - new Date(A.day)) / 864e5) : 0;
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Bilder &amp; Dokumente</h1><p>Körperfotos, Mahlzeiten, InBody-Auswertungen und Blutwerte. Privat gespeichert, nur über dein Konto abrufbar.</p></div></div>
      <section className="panel">
        <h2 id="hochladen">Hochladen</h2>
        {!blobOk && <div className="notice warn">Der Dateispeicher ist noch nicht verbunden.</div>}
        <ActionForm action={uploadMedia} submit="Hochladen">
          <label className="f">Art<select name="kind" defaultValue={MEDIA_KINDS[sp?.art] ? sp.art : "body_photo"}>{Object.entries(MEDIA_KINDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="f">Datum<DateField name="day" defaultValue={todayIso()} /></label>
          <label className="f">Pose (bei Körperfotos)<select name="pose" defaultValue="front"><option value="front">Front</option><option value="side">Seite</option><option value="back">Rücken</option></select></label>
          <label className="f">Notiz<input type="text" name="note" maxLength={200} placeholder="z. B. nüchtern, morgens" /></label>
          <label className="f">Dateien (Bild oder PDF, max. 4 MB)<input type="file" name="file" accept="image/*,application/pdf" multiple required /></label>
        </ActionForm>
        <p className="note">Für Körperfotos: alle 2–4 Wochen, morgens nüchtern, gleiches Licht, gleicher Abstand, Kamera auf Hüfthöhe, entspannt stehen. {ai ? "InBody-Blätter (PDF oder Foto) werden automatisch ausgelesen: Gewicht, Körperfett, Muskelmasse, Viszeralfett usw. landen direkt bei den Eingaben und im Dashboard." : "Automatisches Auslesen von InBody-Blättern wird aktiv, sobald ein Admin Claude freischaltet."}</p>
      </section>
      {(ib.length > 0 || photos.length > 0) && (
        <section className="panel">
          <div className="panel-head"><h2 id="koerper">Körper-Fortschritt</h2><span className="note">Messungen zuerst, Fotos zur Anschauung</span></div>
          {ib.length > 0 && (
            <>
              {ib.length > 1 && (
                <div className="hl ctx">
                  {[["Gewicht", "weight_kg", " kg", 0], ["Skelettmuskelmasse", "smm_kg", " kg", 1], ["Fettmasse", "fat_mass_kg", " kg", -1], ["Körperfett", "body_fat_pct", " %", -1], ["Viszeralfett", "visceral_level", "", -1]].map(([n, k, u, dir]) => {
                    const dv = delta(k); if (dv == null) return null;
                    return <div key={k} className="hli"><span>{n}</span><b>{d1(last[k])}<small className="note">{u}</small></b><em className={dir === 0 || Math.abs(dv) < 0.05 ? "" : dir * dv > 0 ? "up" : "down"}>{dv > 0 ? "+" : ""}{d1(dv)}{u} seit {ib[0].day.split("-").reverse().join(".")}</em></div>;
                  })}
                </div>
              )}
              <div className="tbl-wrap"><table>
                <thead><tr><th>Messung</th><th className="r">Gewicht</th><th className="r">Muskelmasse</th><th className="r">Fettmasse</th><th className="r">Körperfett</th><th className="r">Viszeral</th></tr></thead>
                <tbody>{ibRows.map((r) => <tr key={r.id}><td className="num">{fmt(r.day)}</td><td className="r num">{d1(r.data?.weight_kg)}</td><td className="r num">{d1(r.data?.smm_kg)}</td><td className="r num">{d1(r.data?.fat_mass_kg)}</td><td className="r num">{d1(r.data?.body_fat_pct)} %</td><td className="r num">{r.data?.visceral_level ?? "–"}</td></tr>)}</tbody>
              </table></div>
            </>
          )}
          {photos.length > 0 && (
            <div className="pcmp">
              <h3>Fotos vergleichen</h3>
              <div className="btnrow">{poses.map((p) => <a key={p} className={`btn sm ${p === pose ? "" : "ghost"}`} href={`${base}/bilder?pose=${p}`}>{POSE[p] || "Ohne Pose"}</a>)}</div>
              {A && B ? (
                <>
                  <form className="form" method="get" action={`${base}/bilder`}>
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
                      {ai && !viewer.demo && (
                        <ActionForm action={comparePhotos} className="btnrow" submit={cmp ? "Neu vergleichen" : "Mit KI vergleichen"} busy="Vergleicht…" reset={false}>
                          <input type="hidden" name="a" value={A.id} /><input type="hidden" name="b" value={B.id} />
                        </ActionForm>
                      )}
                      {ai && <p className="note">Die beiden Fotos werden nur auf Knopfdruck an Claude geschickt (ca. 1–2 Rappen).</p>}
                    </div>
                  </div>
                </>
              ) : <p className="muted">Für einen Vergleich braucht es mindestens zwei Fotos in derselben Pose.</p>}
            </div>
          )}
        </section>
      )}

      {groups.length ? groups.map(([k, list]) => (
        <section className="panel" key={k}>
          <div className="panel-head"><h2>{MEDIA_KINDS[k]}</h2><span className="note">{list.length} Dateien</span></div>
          <div className="gallery">
            {list.map((m) => (
              <figure key={m.id}>
                <a href={`/api/media/${m.id}`} target="_blank" rel="noreferrer">
                  {m.content_type?.startsWith("image/") ? <img src={`/api/media/${m.id}`} alt={`${MEDIA_KINDS[k]} vom ${fmt(m.day)}`} loading="lazy" /> : <div className="doc">PDF</div>}
                </a>
                <figcaption><span>{fmt(m.day)}{m.note ? ` · ${m.note}` : ""}</span>
                  <form action={deleteMedia}><input type="hidden" name="id" value={m.id} /><button className="x" type="submit" aria-label="Löschen">✕</button></form></figcaption>
                {k === "inbody" && m.extracted && (
                  <div className="ib">{Object.entries(INBODY_FIELDS).filter(([f]) => m.extracted[f] != null).slice(0, 8).map(([f, [n, u]]) => <span key={f}><em>{n}</em>{m.extracted[f]}{u && u !== "/100" ? ` ${u}` : ""}</span>)}</div>
                )}
                {k === "inbody" && m.extract_error && <p className="note" style={{ color: "var(--crit)" }}>{m.extract_error}</p>}
                {k === "inbody" && ai && <ActionForm action={rereadInBody} className="btnrow" submit={m.extracted ? "Neu auslesen" : "Werte auslesen"} busy="Liest…" reset={false}><input type="hidden" name="id" value={m.id} /></ActionForm>}
              </figure>
            ))}
          </div>
        </section>
      )) : <div className="empty">Noch keine Dateien.</div>}
    </>
  );
}
