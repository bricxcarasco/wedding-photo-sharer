import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findByHash } from './_lib/drive.js';
import { clientError, methodGuard, requireGuest } from './_lib/http.js';
import { rateLimit } from './_lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const guestId = requireGuest(req, res);
  if (!guestId) return;

  const limit = await rateLimit(`dup:${guestId}`, 300, 60_000);
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return clientError(res, 429, 'Too many requests, slow down a moment');
  }

  const hash = (req.body?.hash ?? '') as string;
  if (!/^[a-f0-9]{64}$/i.test(hash) && !/^fnv_[a-f0-9]+_[a-f0-9]+$/.test(hash)) {
    return clientError(res, 400, 'Invalid hash');
  }

  try {
    // Does ANYONE already have this exact content? (gallery-level dedup)
    const anyMatch = await findByHash(hash);
    // Does THIS guest own a copy? (controls whether replace is allowed)
    const mine = await findByHash(hash, guestId);
    res.status(200).json({
      duplicate: Boolean(anyMatch),
      existingFileId: mine?.id ?? anyMatch?.id ?? null,
      ownedByMe: Boolean(mine),
    });
  } catch (e) {
    console.error('check-duplicate failed', e);
    clientError(res, 500, 'Could not check for duplicates');
  }
}
