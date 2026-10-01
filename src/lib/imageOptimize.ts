// Client-side image optimization.
//
// Goals (section 8):
//  - Produce a high-quality "upload" image (lightly downscaled only if huge) so
//    we don't ship 12MP originals over venue Wi-Fi, but DON'T over-compress.
//  - Produce a small gallery THUMBNAIL (fast grid loading).
//  - Normalize orientation (browsers apply EXIF orientation on decode via
//    createImageBitmap({ imageOrientation: 'from-image' })), which also strips
//    EXIF/GPS on re-encode — a privacy win.
//  - Never freeze the UI: the heavy work runs in a Web Worker when supported,
//    with a main-thread fallback that yields.
//
// We feature-detect WebP encode support and fall back to JPEG.

export interface OptimizeOptions {
  maxUploadEdge: number; // longest edge for the uploaded "original"
  thumbEdge: number; // longest edge for the gallery thumbnail
  uploadQuality: number; // 0..1
  thumbQuality: number; // 0..1
}

export const DEFAULT_OPTIONS: OptimizeOptions = {
  maxUploadEdge: 2560, // keeps wedding photos crisp, trims absurd 4000px+ shots
  thumbEdge: 800,
  uploadQuality: 0.9, // high — we are NOT trying to crunch wedding photos
  thumbQuality: 0.72,
};

export interface OptimizeResult {
  uploadBlob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  mime: string; // mime of uploadBlob
}

/** Compute target dimensions preserving aspect ratio, only shrinking. */
export function fitWithin(
  w: number,
  h: number,
  maxEdge: number
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: maxEdge, height: maxEdge };
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

let webpSupport: boolean | null = null;
/** Is `image/webp` canvas encoding supported? Cached. */
export function supportsWebpEncode(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

const workerSupported =
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof createImageBitmap !== 'undefined';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (r: OptimizeResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/optimize.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (ev: MessageEvent) => {
      const { id, ok, result, error } = ev.data as {
        id: number;
        ok: boolean;
        result?: OptimizeResult;
        error?: string;
      };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok && result) p.resolve(result);
      else p.reject(new Error(error || 'optimize failed'));
    };
    worker.onerror = () => {
      // If the worker dies, reject everything so callers fall back.
      for (const [, p] of pending) p.reject(new Error('optimize worker error'));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

/**
 * Optimize a File/Blob into { uploadBlob, thumbBlob }. Uses a worker when
 * available, otherwise a main-thread fallback. If the file isn't a raster image
 * we can decode, we pass the bytes through unchanged (still validated upstream).
 */
export async function optimizeImage(
  file: Blob,
  opts: OptimizeOptions = DEFAULT_OPTIONS
): Promise<OptimizeResult> {
  if (workerSupported) {
    try {
      return await runInWorker(file, opts);
    } catch {
      // fall through to main thread
    }
  }
  return runOnMainThread(file, opts);
}

function runInWorker(file: Blob, opts: OptimizeOptions): Promise<OptimizeResult> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, file, opts, preferWebp: true });
    // Safety timeout so a stuck worker never wedges an upload forever.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('optimize timeout'));
      }
    }, 20000);
  });
}

async function runOnMainThread(
  file: Blob,
  opts: OptimizeOptions
): Promise<OptimizeResult> {
  // Decode with orientation applied.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  } as ImageBitmapOptions).catch(() => createImageBitmap(file));

  const mime = supportsWebpEncode() ? 'image/webp' : 'image/jpeg';
  const upload = await drawAndEncode(
    bitmap,
    opts.maxUploadEdge,
    opts.uploadQuality,
    mime
  );
  const thumb = await drawAndEncode(bitmap, opts.thumbEdge, opts.thumbQuality, mime);
  bitmap.close?.();
  return {
    uploadBlob: upload.blob,
    thumbBlob: thumb.blob,
    width: upload.width,
    height: upload.height,
    mime,
  };
}

async function drawAndEncode(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  mime: string
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), mime, quality)
  );
  if (!blob) throw new Error('encode failed');
  return { blob, width, height };
}
