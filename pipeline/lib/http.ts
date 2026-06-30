import { ProxyAgent } from "undici";
import { CONFIG } from "../config";
import { cacheKey, readCache, writeCache } from "./cache";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Optional proxy so bot-blocked OEM locators work from a non-blocked IP. Scraping
// proxies (ScraperAPI etc.) intercept HTTPS with their own cert, so don't verify the
// tunnelled TLS — we're fetching public data through a trusted unblocking service.
const proxyDispatcher = CONFIG.http.proxyUrl
  ? new ProxyAgent({ uri: CONFIG.http.proxyUrl, requestTls: { rejectUnauthorized: false } })
  : undefined;
if (proxyDispatcher) console.log(`[http] routing OEM requests through proxy ${new URL(CONFIG.http.proxyUrl).host}`);

/** Per-host timestamp of last request, used to honour minDelayMs politeness. */
const lastHit = new Map<string, number>();

async function politeWait(host: string) {
  const now = Date.now();
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + CONFIG.http.minDelayMs - now;
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Cache namespace; when set, responses are read from / written to disk cache. */
  cacheNs?: string;
  /** Extra parts to disambiguate the cache key (e.g. POST body). */
  cacheParts?: unknown[];
  timeoutMs?: number;
  retries?: number;
  /** Route this request through PROXY_URL (used by OEM adapters). */
  useProxy?: boolean;
  /** Treat a non-2xx as retryable rather than throwing immediately. */
  acceptText?: boolean;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  fromCache: boolean;
  url: string;
}

/**
 * Resilient text fetch with disk cache, per-host rate limiting, exponential
 * backoff, and a browser-ish UA. Returns a result object (never throws on HTTP
 * status) so callers can degrade gracefully when a source blocks automated traffic.
 */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const method = opts.method ?? "GET";
  const ns = opts.cacheNs;
  const key = cacheKey([method, url, opts.cacheParts ?? opts.body ?? null]);

  if (ns && CONFIG.http.useCache) {
    const cached = readCache<{ status: number; text: string }>(ns, key);
    if (cached) return { ...cached, ok: cached.status >= 200 && cached.status < 300, fromCache: true, url };
  }

  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  const maxRetries = opts.retries ?? CONFIG.http.maxRetries;
  const timeoutMs = opts.timeoutMs ?? CONFIG.http.timeoutMs;
  let lastErr = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await politeWait(host);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "User-Agent": CONFIG.http.userAgent,
          Accept: "application/json, text/plain, */*",
          ...opts.headers,
        },
        body: opts.body,
        redirect: "follow",
        signal: ctrl.signal,
        // undici proxy dispatcher (OEM adapters opt in via useProxy)
        ...(opts.useProxy && proxyDispatcher ? { dispatcher: proxyDispatcher } : {}),
      } as RequestInit & { dispatcher?: unknown });
      const text = await res.text();
      clearTimeout(timer);

      // 429 / 5xx are transient — back off and retry.
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        lastErr = `HTTP ${res.status}`;
        await sleep(Math.min(30_000, 1000 * 2 ** attempt));
        continue;
      }

      const result: FetchResult = {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        text,
        fromCache: false,
        url: res.url || url,
      };
      // Only cache successful bodies, so transient blocks don't poison the cache.
      if (ns && result.ok) writeCache(ns, key, { status: result.status, text: result.text });
      return result;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
  }

  return { ok: false, status: 0, text: `fetch failed: ${lastErr}`, fromCache: false, url };
}
