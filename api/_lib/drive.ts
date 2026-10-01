// Server-side Google Drive client. Secrets live ONLY here (Vercel env vars).
// Never import this from anything under /src — it would leak credentials.

import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';

export const APP_TAG = 'bricx-hannah-2027';

let driveClient: drive_v3.Drive | null = null;
let oauthClient: InstanceType<typeof google.auth.OAuth2> | null = null;
const folderCache = new Map<string, string>(); // name -> id (per cold start)

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getOAuth(): InstanceType<typeof google.auth.OAuth2> {
  if (oauthClient) return oauthClient;
  oauthClient = new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET')
  );
  oauthClient.setCredentials({ refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN') });
  return oauthClient;
}

export function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;
  driveClient = google.drive({ version: 'v3', auth: getOAuth() });
  return driveClient;
}

/** A fresh (auto-refreshed) OAuth access token for raw REST calls. */
export async function getAccessToken(): Promise<string> {
  const token = await getOAuth().getAccessToken();
  const accessToken = typeof token === 'string' ? token : token?.token;
  if (!accessToken) throw new Error('Could not obtain access token');
  return accessToken;
}

export function rootFolderId(): string {
  return requireEnv('GOOGLE_DRIVE_FOLDER_ID');
}

/** Find-or-create a subfolder under the wedding root. Cached per invocation. */
export async function getSubfolderId(name: 'Originals' | 'Thumbnails'): Promise<string> {
  const cached = folderCache.get(name);
  if (cached) return cached;
  const drive = getDrive();
  const parent = rootFolderId();
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `'${parent}' in parents`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ].join(' and ');
  const res = await drive.files.list({
    q,
    fields: 'files(id,name)',
    pageSize: 1,
    spaces: 'drive',
  });
  let id = res.data.files?.[0]?.id ?? null;
  if (!id) {
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id',
    });
    id = created.data.id ?? null;
  }
  if (!id) throw new Error(`Could not resolve folder ${name}`);
  folderCache.set(name, id);
  return id;
}

/** Query a file by content hash (optionally scoped to a guest). */
export async function findByHash(
  hash: string,
  guestId?: string
): Promise<drive_v3.Schema$File | null> {
  const drive = getDrive();
  const clauses = [
    `appProperties has { key='sha256' and value='${escapeValue(hash)}' }`,
    `appProperties has { key='app' and value='${APP_TAG}' }`,
    'trashed = false',
  ];
  if (guestId) {
    clauses.push(`appProperties has { key='guestId' and value='${escapeValue(guestId)}' }`);
  }
  const res = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'files(id,name,appProperties)',
    pageSize: 1,
    spaces: 'drive',
  });
  return res.data.files?.[0] ?? null;
}

/** Begin a resumable upload session; returns the Drive-issued session URL. */
export async function startResumableSession(params: {
  name: string;
  mimeType: string;
  guestId: string;
  hash: string;
  width: number | null;
  height: number | null;
}): Promise<string> {
  const parent = await getSubfolderId('Originals');
  const accessToken = await getAccessToken();

  const metadata = {
    name: params.name,
    parents: [parent],
    appProperties: {
      app: APP_TAG,
      guestId: params.guestId,
      sha256: params.hash,
      uploadedAt: String(Date.now()),
      width: params.width != null ? String(params.width) : '',
      height: params.height != null ? String(params.height) : '',
    },
  };

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!resp.ok) {
    throw new Error(`Drive resumable init failed: ${resp.status} ${await resp.text()}`);
  }
  const location = resp.headers.get('location');
  if (!location) throw new Error('Drive did not return a resumable session URL');
  return location;
}

/** Upload (or replace) the thumbnail for a given original file id. */
export async function uploadThumbnailFor(
  originalId: string,
  guestId: string,
  thumb: Buffer,
  mime: string
): Promise<string> {
  const drive = getDrive();
  const parent = await getSubfolderId('Thumbnails');
  // Thumbnail name ties back to the original by id for easy lookup.
  const name = `thumb_${originalId}`;
  // Remove a previous thumbnail if present (idempotent re-finalize).
  const existing = await drive.files.list({
    q: [
      `name = '${name}'`,
      `'${parent}' in parents`,
      `appProperties has { key='guestId' and value='${escapeValue(guestId)}' }`,
      'trashed = false',
    ].join(' and '),
    fields: 'files(id)',
    pageSize: 1,
  });
  const prev = existing.data.files?.[0]?.id;
  if (prev) await drive.files.delete({ fileId: prev }).catch(() => {});

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [parent],
      appProperties: { app: APP_TAG, guestId, originalId },
    },
    media: { mimeType: mime, body: Readable.from(thumb) },
    fields: 'id',
  });
  return created.data.id!;
}

export interface ListedPhoto {
  id: string;
  name: string;
  guestId: string;
  width: number | null;
  height: number | null;
  uploadedAt: number;
}

export interface ListResult {
  photos: ListedPhoto[];
  nextPageToken: string | null;
}

/** List originals (optionally scoped to one guest), newest first, paginated. */
export async function listPhotos(opts: {
  guestId?: string;
  pageToken?: string | null;
  pageSize?: number;
}): Promise<ListResult> {
  const drive = getDrive();
  const parent = await getSubfolderId('Originals');
  const clauses = [
    `'${parent}' in parents`,
    `appProperties has { key='app' and value='${APP_TAG}' }`,
    'trashed = false',
  ];
  if (opts.guestId) {
    clauses.push(`appProperties has { key='guestId' and value='${escapeValue(opts.guestId)}' }`);
  }
  const res = await drive.files.list({
    q: clauses.join(' and '),
    fields: 'nextPageToken, files(id,name,appProperties,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: Math.min(60, Math.max(1, opts.pageSize ?? 24)),
    pageToken: opts.pageToken || undefined,
    spaces: 'drive',
  });
  const photos: ListedPhoto[] = (res.data.files ?? []).map((f) => {
    const ap = f.appProperties ?? {};
    const uploadedAt = ap.uploadedAt
      ? Number(ap.uploadedAt)
      : f.createdTime
        ? Date.parse(f.createdTime)
        : Date.now();
    return {
      id: f.id!,
      name: f.name ?? 'photo',
      guestId: ap.guestId ?? '',
      width: ap.width ? Number(ap.width) : null,
      height: ap.height ? Number(ap.height) : null,
      uploadedAt,
    };
  });
  return { photos, nextPageToken: res.data.nextPageToken ?? null };
}

/** Find the thumbnail file id for an original (for streaming). */
export async function findThumbnailId(originalId: string): Promise<string | null> {
  const drive = getDrive();
  const parent = await getSubfolderId('Thumbnails');
  const res = await drive.files.list({
    q: [
      `name = 'thumb_${originalId}'`,
      `'${parent}' in parents`,
      'trashed = false',
    ].join(' and '),
    fields: 'files(id)',
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Stream a file's bytes (used by the thumbnail proxy). */
export async function getFileStream(
  fileId: string
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string }> {
  const drive = getDrive();
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const resp = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return {
    stream: resp.data as unknown as NodeJS.ReadableStream,
    mimeType: meta.data.mimeType || 'image/jpeg',
  };
}

function escapeValue(v: string): string {
  // Drive query values use single quotes; escape embedded quotes/backslashes.
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
