import { detectTech, pamAngles, type Detection, type PamAngle } from "../../lib/tech-fingerprints";

export interface TechResult {
  ok: boolean;
  status?: number;
  finalUrl?: string;
  detections: Detection[];
  angles: PamAngle[];
  error?: string;
}

/** Fetch a dealer's homepage and fingerprint its lead-handling tech. Free, from their own site. */
export async function fingerprintSite(url: string): Promise<TechResult> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DanBot/1.0; +https://pam.ai)" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const html = await res.text();
    const detections = detectTech(html);
    return { ok: res.ok, status: res.status, finalUrl: res.url, detections, angles: pamAngles(detections) };
  } catch (e) {
    return { ok: false, detections: [], angles: [], error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
