import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findThumbnailId, getFileStream } from '../_lib/drive.js';
import { isValidDriveFileId } from '../_lib/validate.js';

// Streams a photo's thumbnail. The client never sees Drive URLs or tokens.
// Thumbnails are immutable per original id, so we cache hard at the edge.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const originalId = (Array.isArray(req.query.id) ? req.query.id[0] : req.query.id) || '';
  if (!isValidDriveFileId(originalId)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  try {
    const thumbId = await findThumbnailId(originalId);
    // If no thumbnail yet (e.g. finalize pending), fall back to the original.
    const target = thumbId || originalId;
    const { stream, mimeType } = await getFileStream(target);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    stream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
    });
    stream.pipe(res);
  } catch (e) {
    console.error('thumb failed', e);
    if (!res.headersSent) res.status(404).json({ error: 'Thumbnail not found' });
  }
}
