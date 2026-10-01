import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listPhotos } from './_lib/drive.js';
import { clientError, methodGuard, requireGuest } from './_lib/http.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'GET')) return;
  const guestId = requireGuest(req, res);
  if (!guestId) return;

  try {
    const { photos } = await listPhotos({ guestId, pageSize: 60 });
    res.setHeader('Cache-Control', 'private, max-age=10');
    res.status(200).json({
      photos: photos.map((p) => ({
        id: p.id,
        name: p.name,
        thumbnailUrl: `/api/thumb/${p.id}`,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        uploadedAt: p.uploadedAt,
        mine: true,
      })),
    });
  } catch (e) {
    console.error('my-photos failed', e);
    clientError(res, 500, 'Could not load your photos');
  }
}
