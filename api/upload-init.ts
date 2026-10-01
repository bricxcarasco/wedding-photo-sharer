import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findByHash, getDrive, startResumableSession } from './_lib/drive.js';
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  clientError,
  methodGuard,
  requireGuest,
  signSession,
} from './_lib/http.js';
import { rateLimit } from './_lib/rateLimit.js';
import { sanitizeServerName } from './_lib/validate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'POST')) return;
  const guestId = requireGuest(req, res);
  if (!guestId) return;

  const limit = await rateLimit(`init:${guestId}`, 500, 60_000);
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfterMs / 1000));
    return clientError(res, 429, 'Too many uploads at once, please wait a moment');
  }

  const body = (req.body ?? {}) as {
    name?: string;
    type?: string;
    size?: number;
    hash?: string;
    width?: number | null;
    height?: number | null;
    replace?: boolean;
    existingFileId?: string | null;
  };

  // ── Validation (section 17) ───────────────────────────────────────────────
  const type = String(body.type || '');
  if (!ALLOWED_MIME.has(type)) return clientError(res, 400, 'Unsupported file type');
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return clientError(res, 413, 'File too large');
  }
  const hash = String(body.hash || '');
  if (!/^[a-f0-9]{64}$/i.test(hash) && !/^fnv_[a-f0-9]+_[a-f0-9]+$/.test(hash)) {
    return clientError(res, 400, 'Invalid hash');
  }
  const name = sanitizeServerName(body.name || 'photo.jpg');

  try {
    // Guard against duplicate races unless the guest explicitly chose replace.
    if (!body.replace) {
      const existing = await findByHash(hash);
      if (existing) {
        return res.status(409).json({
          error: 'Duplicate',
          duplicate: true,
          existingFileId: existing.id,
          ownedByMe: Boolean(await findByHash(hash, guestId)),
          resumableUrl: '',
          fileId: null,
        });
      }
    } else if (body.existingFileId) {
      // Replace: verify ownership before trashing the old copy.
      const owned = await findByHash(hash, guestId);
      if (owned && owned.id === body.existingFileId) {
        await getDrive().files.delete({ fileId: body.existingFileId }).catch(() => {});
      }
      // If not owned, we silently ignore the replace and just upload a new one
      // owned by this guest — a guest can never delete another guest's file.
    }

    const driveUrl = await startResumableSession({
      name,
      mimeType: type,
      guestId,
      hash,
      width: body.width ?? null,
      height: body.height ?? null,
    });

    const session = signSession({ url: driveUrl, guestId });
    res.status(200).json({
      resumableUrl: session,
      fileId: null,
      duplicate: false,
      existingFileId: null,
      ownedByMe: false,
    });
  } catch (e) {
    console.error('upload-init failed', e);
    clientError(res, 500, 'Could not start the upload');
  }
}
