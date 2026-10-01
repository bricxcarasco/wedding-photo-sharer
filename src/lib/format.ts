export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

/**
 * Make an untrusted filename safe for display and for use as a Drive name.
 * Strips path separators and control chars, collapses whitespace, caps length,
 * and guarantees a non-empty result.
 */
export function sanitizeFilename(name: string): string {
  const base = (name || 'photo.jpg')
    .replace(/[\\/]/g, '-') // path separators
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '') // control chars
    .replace(/[<>:"|?*]/g, '') // reserved
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base.length ? base : 'photo.jpg';
}
