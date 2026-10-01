// Server-side input validation helpers.

/** Sanitize a filename for safe use as a Drive file name. */
export function sanitizeServerName(name: string): string {
  const base = String(name || 'photo.jpg')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\\/]/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base.length ? base : 'photo.jpg';
}

/** Parse a Content-Range header like "bytes 0-1048575/5242880". */
export function parseContentRange(
  header: string | undefined
): { start: number; end: number; total: number } | null {
  if (!header) return null;
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  const total = Number(m[3]);
  if (end < start || total <= 0 || end >= total) return null;
  return { start, end, total };
}

export function isValidDriveFileId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,100}$/.test(id);
}
