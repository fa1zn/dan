import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONFIG } from "../config";

/** Stable cache key from any descriptor (URL, body, etc.). */
export function cacheKey(parts: unknown[]): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

function cachePath(namespace: string, key: string): string {
  const dir = path.join(CONFIG.cacheDir, namespace);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, `${key}.json`);
}

export function readCache<T = unknown>(namespace: string, key: string): T | null {
  const p = cachePath(namespace, key);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache(namespace: string, key: string, value: unknown): void {
  writeFileSync(cachePath(namespace, key), JSON.stringify(value));
}
