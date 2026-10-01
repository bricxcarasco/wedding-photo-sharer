// Shared HTTP helpers for the serverless functions.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per optimized photo
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);

/** Extract and lightly validate the anonymous guest id. */
export function getGuestId(req: VercelRequest): string | null {
  const raw = req.headers['x-guest-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) return null;
  // Format: guest_<hex>. No PII; reject anything weird.
  if (!/^guest_[a-f0-9]{16,64}$/i.test(id)) return null;
  return id;
}

export function requireGuest(req: VercelRequest, res: VercelResponse): string | null {
  const id = getGuestId(req);
  if (!id) {
    res.status(401).json({ error: 'Missing or invalid guest id' });
    return null;
  }
  return id;
}

export function methodGuard(
  req: VercelRequest,
  res: VercelResponse,
  method: string | string[]
): boolean {
  const allowed = Array.isArray(method) ? method : [method];
  if (!allowed.includes(req.method || '')) {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

// ── Opaque signed session tokens ────────────────────────────────────────────
// We never hand the raw Drive resumable URL to the browser. Instead we sign a
// small payload { url, guestId, exp } with an HMAC derived from the Google
// client secret, and give the client an opaque token. On each chunk the proxy
// verifies the token, so a client cannot point the proxy at an arbitrary URL.

function secret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || 'dev-only-insecure-secret';
}

export function signSession(payload: { url: string; guestId: string }): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 6 })
  ).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifySession(
  token: string
): { url: string; guestId: string } | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      url: string;
      guestId: string;
      exp: number;
    };
    if (data.exp < Date.now()) return null;
    return { url: data.url, guestId: data.guestId };
  } catch {
    return null;
  }
}

/** Read a raw request body as a Buffer (for binary chunk/thumbnail uploads). */
export function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > MAX_UPLOAD_BYTES + 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function clientError(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}
