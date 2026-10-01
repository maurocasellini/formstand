import crypto from "node:crypto";

// AES-256-GCM für API-Tokens. ENCRYPTION_KEY = 32 Bytes base64.
// Fehlt der Schlüssel oder hat er nicht genau 32 Bytes, wird er aus dem vorhandenen Geheimnis abgeleitet.
function key() {
  const k = process.env.ENCRYPTION_KEY;
  if (k) { const b = Buffer.from(k, "base64"); if (b.length === 32) return b; }
  const s = k || process.env.SESSION_SECRET;
  if (!s) throw new Error("ENCRYPTION_KEY fehlt");
  return crypto.createHash("sha256").update(s).digest();
}

export function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(blob) {
  if (!blob) return null;
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function randomState() { return crypto.randomBytes(16).toString("hex"); }
