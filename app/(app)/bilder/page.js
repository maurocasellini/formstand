import { viewerAndSubject } from "@/lib/subject";
import * as repo from "@/lib/repo";
import { todayIso } from "@/lib/metrics";
import { MEDIA_KINDS } from "@/lib/catalog";
import { uploadMedia, deleteMedia, rereadInBody } from "../../actions-data";
import { aiReady } from "@/lib/ai";
import { INBODY_FIELDS } from "@/lib/ai";
import ActionForm from "@/components/ActionForm";

export const maxDuration = 60;
const fmt = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;

export default async function Bilder() {
  const { subject } = await viewerAndSubject();
  const media = (await repo.getMedia(subject.id)).sort((a, b) => (a.day === b.day ? (a.created_at < b.created_at ? 1 : -1) : a.day < b.day ? 1 : -1));
  const blobOk = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const ai = await aiReady();
  const groups = Object.keys(MEDIA_KINDS).map((k) => [k, media.filter((m) => m.kind === k)]).filter(([, l]) => l.length);
  return (
    <>
      <div className="head"><div style={{ display: "grid", gap: 4 }}><h1>Bilder &amp; Dokumente</h1><p>Körperfotos, Mahlzeiten, InBody-Auswertungen und Blutwerte. Privat gespeichert, nur über dein Konto abrufbar.</p></div></div>
      <section className="panel">
        <h2>Hochladen</h2>
        {!blobOk && <div className="notice warn">Der Dateispeicher ist noch nicht verbunden.</div>}
        <ActionForm action={uploadMedia} submit="Hochladen">
          <label className="f">Art<select name="kind" defaultValue="body_photo">{Object.entries(MEDIA_KINDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="f">Datum<input type="date" name="day" defaultValue={todayIso()} /></label>
          <label className="f">Notiz<input type="text" name="note" maxLength={200} placeholder="z. B. Front, nüchtern" /></label>
          <label className="f">Dateien (Bild oder PDF, max. 4 MB)<input type="file" name="file" accept="image/*,application/pdf" multiple required /></label>
        </ActionForm>
        <p className="note">Für Körperfotos: gleiche Pose, Licht und Abstand, alle 4 Wochen. {ai ? "InBody-Blätter (PDF oder Foto) werden automatisch ausgelesen: Gewicht, Körperfett, Muskelmasse, Viszeralfett usw. landen direkt bei den Eingaben und im Dashboard." : "Automatisches Auslesen von InBody-Blättern wird aktiv, sobald ein Admin Claude freischaltet."}</p>
      </section>
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
