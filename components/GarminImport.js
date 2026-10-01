"use client";
import { useState } from "react";

const MAX_CHUNK = 2_500_000; // Zeichen JSON pro Anfrage

export default function GarminImport() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [sum, setSum] = useState(null);

  async function run(file) {
    setBusy(true); setLog([]); setSum(null);
    const add = (t) => setLog((l) => [...l.slice(-6), t]);
    try {
      const JSZip = (await import("jszip")).default;
      add("ZIP wird geöffnet…");
      const zip = await JSZip.loadAsync(file);
      const files = Object.values(zip.files).filter((f) => !f.dir && /\.json$/i.test(f.name) && /DI[_-]CONNECT/i.test(f.name));
      if (!files.length) throw new Error("Keine Garmin-Daten gefunden. Bitte die ZIP aus „Daten exportieren“ von Garmin Connect wählen.");
      const totals = { daily: 0, activities: 0, raw: 0, files: 0, skipped: 0 };
      let i = 0;
      for (const f of files) {
        i++;
        let json;
        try { json = JSON.parse(await f.async("string")); } catch { totals.skipped++; continue; }
        const records = Array.isArray(json) ? json.flatMap((x) => (x && typeof x === "object" && Object.keys(x).length === 1 && Array.isArray(Object.values(x)[0]) ? Object.values(x)[0] : [x]))
          : json && typeof json === "object" ? (Object.values(json).find(Array.isArray) || [json]) : [];
        if (!records.length) continue;
        // in Teile schneiden, damit jede Anfrage klein bleibt
        let chunk = [], size = 0, offset = 0;
        const send = async (last) => {
          if (!chunk.length) return;
          const r = await fetch("/api/import/garmin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: f.name, records: chunk, offset, last: last && i === files.length, total: totals.raw }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `Import fehlgeschlagen (${r.status})`);
          totals.daily += j.daily; totals.activities += j.activities; totals.raw += j.raw;
          offset += chunk.length; chunk = []; size = 0;
        };
        for (const rec of records) {
          const s = JSON.stringify(rec).length;
          if (s > MAX_CHUNK) { totals.skipped++; continue; }
          if (size + s > MAX_CHUNK) await send(false);
          chunk.push(rec); size += s;
        }
        await send(true);
        totals.files++;
        add(`${i}/${files.length} · ${f.name.split("/").pop()}`);
      }
      setSum(totals);
    } catch (e) {
      add(String(e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <label className="f">Garmin-Export (ZIP)
        <input type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
      </label>
      {busy && <div className="notice warn">Import läuft, Seite bitte offen lassen…</div>}
      {log.length > 0 && <div className="note num" style={{ whiteSpace: "pre-wrap" }}>{log.join("\n")}</div>}
      {sum && <div className="notice good">Fertig: {sum.files} Dateien, {sum.daily.toLocaleString("de-CH")} Tageswerte, {sum.activities.toLocaleString("de-CH")} Workouts, {sum.raw.toLocaleString("de-CH")} Rohdatensätze gespeichert{sum.skipped ? `, ${sum.skipped} übersprungen` : ""}.</div>}
    </div>
  );
}
