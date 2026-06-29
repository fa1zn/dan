import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONFIG } from "../config";
import type { RawRecord } from "../../lib/types";

function ensureRawDir(): string {
  if (!existsSync(CONFIG.rawDir)) mkdirSync(CONFIG.rawDir, { recursive: true });
  return CONFIG.rawDir;
}

const safeName = (source: string) => source.replace(/[^a-z0-9._-]+/gi, "_");

/** Persist a source's raw records to /data/raw/<source>.jsonl (overwrites). */
export function writeRaw(source: string, records: RawRecord[]): string {
  const dir = ensureRawDir();
  const file = path.join(dir, `${safeName(source)}.jsonl`);
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
  return file;
}

/** Read every raw JSONL file back into a flat RawRecord[]. */
export function readAllRaw(): RawRecord[] {
  const dir = ensureRawDir();
  const out: RawRecord[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    const lines = readFileSync(path.join(dir, f), "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as RawRecord);
      } catch {
        // skip malformed line
      }
    }
  }
  return out;
}
