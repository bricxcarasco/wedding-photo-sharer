/// <reference lib="webworker" />
// Image optimization worker. Runs off the main thread so large photos never
// freeze the UI. Uses OffscreenCanvas + createImageBitmap (orientation applied).

import { fitWithin, type OptimizeOptions, type OptimizeResult } from '../lib/imageOptimize';

interface Req {
  id: number;
  file: Blob;
  opts: OptimizeOptions;
  preferWebp: boolean;
}

async function encode(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  mime: string
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: mime, quality });
  return { blob, width, height };
}

async function pickMime(preferWebp: boolean): Promise<string> {
  if (!preferWebp) return 'image/jpeg';
  try {
    const probe = new OffscreenCanvas(1, 1);
    const b = await probe.convertToBlob({ type: 'image/webp' });
    return b.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, file, opts, preferWebp } = ev.data;
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    } as ImageBitmapOptions).catch(() => createImageBitmap(file));

    const mime = await pickMime(preferWebp);
    const upload = await encode(bitmap, opts.maxUploadEdge, opts.uploadQuality, mime);
    const thumb = await encode(bitmap, opts.thumbEdge, opts.thumbQuality, mime);
    bitmap.close?.();

    const result: OptimizeResult = {
      uploadBlob: upload.blob,
      thumbBlob: thumb.blob,
      width: upload.width,
      height: upload.height,
      mime,
    };
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
};
