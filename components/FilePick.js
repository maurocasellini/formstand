"use client";
import { useEffect, useRef, useState } from "react";

// Grosse Auswahlfläche statt des Browser-Datei-Felds (funktioniert sauber auf dem iPhone: Fotomediathek, Kamera, Dateien).
// Das echte Feld liegt unsichtbar über der Fläche, damit der Tipp direkt darauf landet.
// Fotos vor dem Hochladen verkleinern (längste Seite 2000 px, JPEG): iPhone-Fotos haben oft 3–5 MB,
// der Server nimmt pro Anfrage nur gut 4 MB an. PDFs bleiben unverändert.
async function shrink(file, max = 2000) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
  try {
    const img = await new Promise((ok, bad) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = bad; i.src = u; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (k === 1 && file.size < 1.2e6 && file.type === "image/jpeg") return file;
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export default function FilePick({ name = "file", accept, multiple = false, hint }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const f = box.current?.closest("form");
    if (!f) return;
    const r = () => setFiles([]);
    f.addEventListener("reset", r);
    return () => f.removeEventListener("reset", r);
  }, []);
  return (
    <div className={`fpick${files.length ? " has" : ""}`} ref={box}>
      <input type="file" name={name} accept={accept} multiple={multiple} aria-label="Dateien auswählen"
        onChange={async (e) => {
          const input = e.target, list = [...(input.files || [])];
          setFiles(list.map((x) => x.name));
          if (!list.length || typeof DataTransfer === "undefined") return;
          setBusy(true);
          try {
            const out = await Promise.all(list.map((f) => shrink(f)));
            const dt = new DataTransfer(); out.forEach((f) => dt.items.add(f)); input.files = dt.files;
            setFiles(out.map((x) => `${x.name} (${Math.max(1, Math.round(x.size / 1024))} KB)`));
          } catch {} finally { setBusy(false); }
        }} />
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
      {files.length ? (
        <span><b>{busy ? "Bereite Fotos vor…" : `${files.length} ${files.length === 1 ? "Datei" : "Dateien"} gewählt`}</b><small>{files.slice(0, 3).join(", ")}{files.length > 3 ? " …" : ""} · tippen zum Ändern</small></span>
      ) : (
        <span><b>Fotos oder Dateien auswählen</b><small>{hint}</small></span>
      )}
    </div>
  );
}
