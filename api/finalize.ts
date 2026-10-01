import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDrive, uploadThumbnailFor } from './_lib/drive.js';
import {
  ALLOWED_MIME,
  clientError,
  methodGuard,
  readRawBody,
  requireGuest,
} from './_lib/http.js';
import { isValidDriveFileId } from './_lib/validate.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const guestId = requireGuest(req, res);
  if (!guestId) return;

  const fileId = (Array.isArray(req.query.fileId) ? req.query.fileId[0] : req.query.fileId) || '';
  if (!isValidDriveFileId(fileId)) return clientError(res, 400, 'Invalid file id');

  const mime = (req.headers['content-type'] as string) || 'image/jpeg';
  if (!ALLOWED_MIME.has(mime)) return clientError(res, 400, 'Unsupported thumbnail type');

  try {
    // Confirm the original exists AND belongs to this guest before we attach a
    // thumbnail — a guest can only finalize their own upload.
    const drive = getDrive();
    const meta = await drive.files
      .get({ fileId, fields: 'id,appProperties' })
      .catch(() => null);
    const owner = meta?.data.appProperties?.guestId;
    if (!meta || owner !== guestId) {
      return clientError(res, 403, 'You can only finalize your own photos');
    }

    const thumb = await readRawBody(req);
    const thumbId = await uploadThumbnailFor(fileId, guestId, thumb, mime);

    res.status(200).json({ ok: true, fileId, thumbnailId: thumbId });
  } catch (e) {
    console.error('finalize failed', e);
    clientError(res, 500, 'Could not finalize the photo');
  }
}
