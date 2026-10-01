// Dokumentenspeicher: JSON-Dokumente im privaten Vercel-Blob-Speicher.
// Schreiben mit ETag-Prüfung (ifMatch), damit gleichzeitige Änderungen sich nicht überschreiben.
// Lokal (Tests) ohne Blob-Token: Dateien in LOCAL_STORE.
import { put, get, del, list, BlobPreconditionFailedError, BlobNotFoundError } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const LOCAL = !process.env.BLOB_READ_WRITE_TOKEN ? process.env.LOCAL_STORE || "" : "";
export const hasStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN || LOCAL);
const PREFIX = "db/";

async function streamText(stream) {
  return await new Response(stream).text();
}

async function readRaw(p) {
  if (LOCAL) {
    try { const t = await fs.readFile(path.join(LOCAL, PREFIX + p), "utf8"); return { text: t, etag: String(t.length) + ":" + hash(t) }; }
    catch { return null; }
  }
  try {
    const r = await get(PREFIX + p, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { text: await streamText(r.stream), etag: r.blob.etag };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

async function writeRaw(p, text, etag) {
  if (LOCAL) {
    const f = path.join(LOCAL, PREFIX + p);
    if (etag) { try { const cur = await fs.readFile(f, "utf8"); if (String(cur.length) + ":" + hash(cur) !== etag) throw new Conflict(); } catch (e) { if (e instanceof Conflict) throw e; } }
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, text);
    return;
  }
  try {
    await put(PREFIX + p, text, { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60, ...(etag ? { ifMatch: etag } : {}) });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new Conflict();
    throw e;
  }
}
class Conflict extends Error {}

export async function read(p, fallback) {
  const r = await readRaw(p);
  if (!r) return structuredClone(fallback);
  try { return JSON.parse(r.text); } catch { return structuredClone(fallback); }
}

// Liest, verändert und schreibt ein Dokument. Bei gleichzeitiger Änderung wird neu gelesen (bis 5×).
const locks = new Map();
export async function update(p, fallback, fn) {
  const prev = locks.get(p) || Promise.resolve();
  let release;
  const mine = new Promise((r) => (release = r));
  locks.set(p, prev.then(() => mine));
  await prev;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await readRaw(p);
      let doc = structuredClone(fallback);
      if (r) { try { doc = JSON.parse(r.text); } catch {} }
      const out = await fn(doc);
      const next = out === undefined ? doc : out;
      try { await writeRaw(p, JSON.stringify(next), r?.etag); return next; }
      catch (e) { if (!(e instanceof Conflict)) throw e; await new Promise((s) => setTimeout(s, 80 * (attempt + 1))); }
    }
    throw new Error("Speichern fehlgeschlagen, bitte nochmals versuchen.");
  } finally {
    release();
    if (locks.get(p) === mine) locks.delete(p);
  }
}

export async function write(p, doc) { await writeRaw(p, JSON.stringify(doc)); }

export async function removePrefix(prefix) {
  if (LOCAL) { await fs.rm(path.join(LOCAL, PREFIX + prefix), { recursive: true, force: true }); return; }
  let cursor;
  do {
    const r = await list({ prefix: PREFIX + prefix, cursor, limit: 1000 });
    if (r.blobs.length) await del(r.blobs.map((b) => b.url));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
}
