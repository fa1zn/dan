import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader (no dependency). Imported first in run.ts so CONFIG sees the
 * values. Real environment variables always win over the file.
 */
for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!existsSync(p)) continue;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
