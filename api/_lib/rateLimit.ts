// Lightweight rate limiting + abuse protection.
//
// Default: in-memory sliding window per serverless instance. This is best-effort
// (instances aren't shared), which is fine for a wedding. If Vercel KV / Upstash
// env vars are present we additionally enforce a shared window via REST so a
// burst across instances is still bounded. KV is OPTIONAL.

interface Bucket {
  count: number;
  resetAt: number;
}
const memory = new Map<string, Bucket>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<LimitResult> {
  const now = Date.now();

  // In-memory check (always runs).
  const b = memory.get(key);
  if (!b || b.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
    if (b.count > limit) {
      return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
    }
  }

  // Optional shared KV check.
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      const windowSec = Math.ceil(windowMs / 1000);
      // INCR then set expiry if first hit.
      const incr = await kv(url, token, ['INCR', `rl:${key}`]);
      const count = Number(incr);
      if (count === 1) await kv(url, token, ['EXPIRE', `rl:${key}`, String(windowSec)]);
      if (count > limit) {
        const ttl = await kv(url, token, ['PTTL', `rl:${key}`]);
        return { ok: false, remaining: 0, retryAfterMs: Math.max(0, Number(ttl)) };
      }
      return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
    } catch {
      // KV unavailable → fall back to the in-memory decision above.
    }
  }

  const current = memory.get(key)!;
  return { ok: true, remaining: Math.max(0, limit - current.count), retryAfterMs: 0 };
}

async function kv(url: string, token: string, command: string[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`KV error ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}
