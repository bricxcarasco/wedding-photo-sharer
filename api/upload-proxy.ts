import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MAX_UPLOAD_BYTES,
  clientError,
  methodGuard,
  readRawBody,
  requireGuest,
  verifySession,
} from './_lib/http.js';
import { parseContentRange } from './_lib/validate.js';

// We read the binary chunk ourselves, so disable Vercel's body parser.
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, 'PUT')) return;
  const guestId = requireGuest(req, res);
  if (!guestId) return;

  const token = (Array.isArray(req.query.session) ? req.query.session[0] : req.query.session) || '';
  const session = verifySession(token);
  if (!session) return clientError(res, 403, 'Invalid or expired upload session');
  // The session is bound to the guest who created it — no cross-guest hijack.
  if (session.guestId !== guestId) return clientError(res, 403, 'Session does not belong to you');

  const range = parseContentRange(req.headers['content-range'] as string | undefined);
  if (!range) return clientError(res, 400, 'Missing or invalid Content-Range');
  if (range.total > MAX_UPLOAD_BYTES) return clientError(res, 413, 'File too large');

  let chunk: Buffer;
  try {
    chunk = await readRawBody(req);
  } catch {
    return clientError(res, 413, 'Chunk too large');
  }
  if (chunk.length !== range.end - range.start + 1) {
    return clientError(res, 400, 'Chunk size does not match Content-Range');
  }

  try {
    // Relay to Drive's resumable session URL. Drive returns:
    //  - 308 (Resume Incomplete) with a Range header while more chunks remain
    //  - 200/201 with the file JSON when complete
    const driveRes = await fetch(session.url, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${range.start}-${range.end}/${range.total}`,
        'Content-Type': 'application/octet-stream',
      },
      body: chunk,
    });

    if (driveRes.status === 308) {
      const driveRange = driveRes.headers.get('range');
      if (driveRange) res.setHeader('Range', driveRange);
      return res.status(308).end();
    }

    if (driveRes.ok) {
      const data = (await driveRes.json().catch(() => ({}))) as { id?: string };
      return res.status(200).json({ fileId: data.id ?? null });
    }

    const text = await driveRes.text().catch(() => '');
    console.error('drive chunk relay failed', driveRes.status, text);
    return clientError(res, 502, 'Upload to storage failed');
  } catch (e) {
    console.error('upload-proxy error', e);
    return clientError(res, 502, 'Upload relay error');
  }
}
