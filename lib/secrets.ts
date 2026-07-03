import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/*
 * Symmetric encryption for stored provider credentials (AES-256-GCM). The key comes from
 * APP_SECRET if set, otherwise a random key persisted under data/cache (gitignored) and
 * generated once. Keys are never stored in plaintext in the DB.
 */

const KEY_PATH = path.join(process.cwd(), "data", "cache", "conn.key");

function getKey(): Buffer {
  if (process.env.APP_SECRET) return scryptSync(process.env.APP_SECRET, "dan-connections", 32);
  if (!existsSync(KEY_PATH)) {
    mkdirSync(path.dirname(KEY_PATH), { recursive: true });
    writeFileSync(KEY_PATH, randomBytes(32));
  }
  return readFileSync(KEY_PATH);
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(blob: string): string {
  try {
    const [iv, tag, enc] = blob.split(":").map((s) => Buffer.from(s, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
