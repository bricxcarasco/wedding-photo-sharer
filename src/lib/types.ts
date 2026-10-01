// Shared domain types for the wedding photo app.

export type UploadStatus =
  | 'queued' // waiting in line
  | 'optimizing' // being resized/re-encoded in the worker
  | 'hashing' // computing SHA-256
  | 'checking' // asking the server about duplicates
  | 'duplicate' // server says we already have this (awaiting user choice)
  | 'uploading' // bytes going to Drive (resumable)
  | 'done' // server confirmed in Drive
  | 'failed' // gave up after retries (manual retry available)
  | 'paused'; // offline / user paused

export interface QueueItem {
  id: string; // local uuid
  guestId: string;
  name: string; // sanitized display name
  type: string; // mime of the bytes we will upload
  size: number; // bytes we will upload (optimized)
  originalSize: number; // bytes of the file as selected
  hash: string | null; // sha256 hex of the UPLOAD bytes, once computed
  blob: Blob; // the bytes to upload (optimized original)
  thumbBlob: Blob | null; // small gallery thumbnail
  width: number | null;
  height: number | null;
  status: UploadStatus;
  progress: number; // 0..1
  attempts: number;
  error: string | null;
  driveFileId: string | null; // set once created in Drive
  resumableUrl: string | null; // Drive resumable session (server-proxied)
  bytesSent: number; // for resume
  createdAt: number;
  updatedAt: number;
  // When a duplicate is detected, what the user chose (or null = undecided).
  duplicateResolution: 'keep' | 'replace' | null;
  existingFileId: string | null; // the server's existing copy, if duplicate
}

export interface PhotoRecord {
  id: string; // Drive file id
  name: string;
  thumbnailUrl: string; // our /api/thumb/:id proxy
  width?: number;
  height?: number;
  uploadedAt: number;
  mine: boolean; // did this guest upload it
}

export interface GalleryPage {
  photos: PhotoRecord[];
  nextPageToken: string | null;
}

export interface DuplicateCheckResult {
  duplicate: boolean;
  existingFileId: string | null;
  ownedByMe: boolean; // can this guest replace it?
}

export interface UploadInitResult {
  fileId: string | null; // null until created
  resumableUrl: string; // where the client PUTs chunks (our proxy)
  duplicate: boolean;
  existingFileId: string | null;
  ownedByMe: boolean;
}
