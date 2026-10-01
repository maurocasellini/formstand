// Dateiablage (Fotos, PDFs): Vercel Blob (privat), lokal zum Entwickeln ein Ordner.
import { put, get, del } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const LOCAL = !process.env.BLOB_READ_WRITE_TOKEN && process.env.LOCAL_STORE ? path.join(process.env.LOCAL_STORE, "files-store") : null;
export const filesReady = Boolean(process.env.BLOB_READ_WRITE_TOKEN || LOCAL);

export async function putFile(pathname, buf, contentType) {
  if (LOCAL) { const f = path.join(LOCAL, pathname); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, buf); return { pathname }; }
  const b = await put(pathname, buf, { access: "private", contentType });
  return { pathname: b.pathname };
}
export async function readFile(pathname) {
  if (LOCAL) { try { return await fs.readFile(path.join(LOCAL, pathname)); } catch { return null; } }
  const r = await get(pathname, { access: "private" });
  if (!r || r.statusCode !== 200) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}
export async function removeFile(pathname) {
  if (LOCAL) { await fs.rm(path.join(LOCAL, pathname), { force: true }); return; }
  await del(pathname);
}
