// Centralized API client for the /api/* serverless functions.
//
// Every call carries the anonymous guest id in the X-Guest-Id header. The
// server uses it for ownership (My Photos) and to guard replace/delete.

import { getGuestId } from './guest';
import type {
  DuplicateCheckResult,
  GalleryPage,
  PhotoRecord,
  UploadInitResult,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
  const guestId = await getGuestId();
  return { 'X-Guest-Id': guestId, ...extra };
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export async function checkDuplicate(hash: string): Promise<DuplicateCheckResult> {
  const res = await fetch('/api/check-duplicate', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ hash }),
  });
  return parse<DuplicateCheckResult>(res);
}

/**
 * Open a resumable upload session on the server. Returns the proxy URL the
 * client PUTs chunks to, plus duplicate info.
 */
export async function uploadInit(params: {
  name: string;
  type: string;
  size: number;
  hash: string;
  width: number | null;
  height: number | null;
  replace: boolean;
  existingFileId: string | null;
}): Promise<UploadInitResult> {
  const res = await fetch('/api/upload-init', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  return parse<UploadInitResult>(res);
}

/**
 * PUT one chunk through the proxy. Returns the new committed byte count, or a
 * completed flag with the final fileId. Uses the Content-Range convention of
 * the Drive resumable protocol.
 */
export async function uploadChunk(params: {
  sessionId: string; // our opaque handle to the Drive resumable URL
  chunk: Blob;
  start: number;
  total: number;
  onProgress?: (loaded: number) => void;
}): Promise<{ completed: boolean; fileId: string | null; bytesCommitted: number }> {
  const { sessionId, chunk, start, total, onProgress } = params;
  const end = start + chunk.size - 1;

  // Use XHR for upload progress (fetch lacks upload progress widely).
  const headers = await authHeaders();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/upload-proxy?session=${encodeURIComponent(sessionId)}`);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v as string);
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(start + e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let fileId: string | null = null;
        try {
          const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          fileId = body.fileId ?? null;
        } catch {
          /* 308 interim responses may have no body */
        }
        resolve({ completed: true, fileId, bytesCommitted: total });
      } else if (xhr.status === 308) {
        // Resume Incomplete: parse Range header for committed bytes.
        const range = xhr.getResponseHeader('Range');
        const committed = range ? parseInt(range.split('-')[1], 10) + 1 : end + 1;
        resolve({ completed: false, fileId: null, bytesCommitted: committed });
      } else {
        reject(new ApiError(xhr.status, xhr.responseText || 'chunk upload failed'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'network error'));
    xhr.ontimeout = () => reject(new ApiError(0, 'timeout'));
    xhr.timeout = 120000;
    xhr.send(chunk);
  });
}

/** Upload the small thumbnail (one shot — thumbnails are tiny). */
export async function uploadThumbnail(fileId: string, thumb: Blob): Promise<void> {
  const res = await fetch(`/api/finalize?fileId=${encodeURIComponent(fileId)}`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': thumb.type || 'image/jpeg' }),
    body: thumb,
  });
  await parse<unknown>(res);
}

export async function fetchMyPhotos(): Promise<PhotoRecord[]> {
  const res = await fetch('/api/my-photos', { headers: await authHeaders() });
  const data = await parse<{ photos: PhotoRecord[] }>(res);
  return data.photos;
}

export async function fetchGallery(pageToken?: string | null): Promise<GalleryPage> {
  const url = new URL('/api/gallery', location.origin);
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const res = await fetch(url.toString(), { headers: await authHeaders() });
  return parse<GalleryPage>(res);
}
