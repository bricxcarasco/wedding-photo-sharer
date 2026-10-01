import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listPhotos } from './_lib/drive.js';
import { clientError, getGuestId, methodGuard } from './_lib/http.js';
import { rateLimit } from './_lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  // Gallery is viewable by any guest; guest id is optional and only used to
  // flag which photos are "mine".
  const guestId = getGuestId(req);

  const limit = await rateLimit(`gallery:${guestId || req.socket.remoteAddress || 'anon'}`, 120, 60_000);
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return clientError(res, 429, 'Too many requests');
  }

  const pageToken =
    (Array.isArray(req.query.pageToken) ? req.query.pageToken[0] : req.query.pageToken) || null;

  try {
    const { photos, nextPageToken } = await listPhotos({ pageToken, pageSize: 24 });
    // Thumbnails are immutable per file id, so they can be cached at the edge.
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.status(200).json({
      photos: photos.map((p) => ({
        id: p.id,
        name: p.name,
        thumbnailUrl: `/api/thumb/${p.id}`,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        uploadedAt: p.uploadedAt,
        mine: Boolean(guestId && p.guestId === guestId),
      })),
      nextPageToken,
    });
  } catch (e) {
    console.error('gallery failed', e);
    clientError(res, 500, 'Could not load the gallery');
  }
}
