// Content hashing for duplicate detection.
//
// We hash the RAW BYTES of the blob we are going to upload with SHA-256 using
// the Web Crypto API. Filenames are deliberately NOT part of the key because
// phones reuse names like IMG_0001.jpg.
//
// SubtleCrypto.digest hashes an entire ArrayBuffer at once. For large photos we
// read the blob fully (phones photos are ~2-12MB — acceptable) but we expose a
// streaming-friendly signature so callers can await without blocking paint.

export function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** SHA-256 hex digest of a Blob's bytes. */
export async function sha256OfBlob(blob: Blob): Promise<string> {
  // crypto.subtle requires a secure context (https/localhost) — true on Vercel.
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Extremely defensive fallback: a weak non-cryptographic hash so the app
    // still functions on an insecure origin during odd local setups.
    return weakHash(await blobToArrayBuffer(blob));
  }
  const buf = await blobToArrayBuffer(blob);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return bufferToHex(digest);
}

/** Read a Blob's bytes, tolerating environments without Blob.arrayBuffer(). */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  if (typeof Response === 'function') return new Response(blob).arrayBuffer();
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** FNV-1a 32-bit, hex-padded. Only a last-resort fallback; not for security. */
export function weakHash(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return 'fnv_' + (h >>> 0).toString(16).padStart(8, '0') + '_' + bytes.length.toString(16);
}
