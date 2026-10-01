// The upload engine: a persistent, concurrency-limited, resumable queue.
//
// Design notes (see ARCHITECTURE.md §7, §9):
//  - It is a SINGLETON MODULE, not React state, so it keeps running across
//    route changes. React subscribes to a read-only snapshot.
//  - Every item (including its Blob) lives in IndexedDB, so the queue survives
//    reload / crash / "browser closed → reopened". On start we rehydrate and
//    resume anything not done.
//  - Concurrency is capped (default 3). Each slot runs the pipeline:
//      optimizing → hashing → checking(dup) → uploading(resumable) → done
//  - Failures retry with exponential backoff + jitter, capped; then park as
//    'failed' with a manual retry.
//  - Nothing is reported 'done' until the server confirms (finalize).

import {
  allItems,
  deleteItem,
  getItem,
  pruneDone,
  putItem,
} from './db';
import { sanitizeFilename } from './format';
import { getGuestId } from './guest';
import { sha256OfBlob } from './hash';
import {
  ApiError,
  checkDuplicate,
  uploadChunk,
  uploadInit,
  uploadThumbnail,
} from './api';
import { DEFAULT_OPTIONS, optimizeImage } from './imageOptimize';
import { isOnline, onConnectivityChange } from './net';
import type { QueueItem, UploadStatus } from './types';

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 6;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB
const BACKOFF_BASE = 1000;
const BACKOFF_MAX = 30000;

export interface EngineConfig {
  concurrency: number;
  maxAttempts: number;
  chunkSize: number;
  backoffBase: number;
  backoffMax: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  concurrency: CONCURRENCY,
  maxAttempts: MAX_ATTEMPTS,
  chunkSize: CHUNK_SIZE,
  backoffBase: BACKOFF_BASE,
  backoffMax: BACKOFF_MAX,
};

export interface EngineSnapshot {
  items: QueueItem[];
  online: boolean;
  activeCount: number;
}

type Listener = (snap: EngineSnapshot) => void;

// Public, non-serializable fields (Blobs) are kept out of what we expose to the
// UI where possible, but it's fine for React to hold them in memory.

class UploadEngine {
  private items = new Map<string, QueueItem>();
  private running = new Set<string>();
  private listeners = new Set<Listener>();
  private started = false;
  private disposed = false;
  private online = isOnline();
  private cfg: EngineConfig;
  // Duplicate decisions the user still has to make block that item until set.

  constructor(config: Partial<EngineConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
  }

  /** Stop scheduling new work (used by tests to isolate instances). */
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    onConnectivityChange((online) => {
      this.online = online;
      if (online) this.pump();
      this.emit();
    });

    // Resume on return / after reload.
    const persisted = await allItems();
    for (const item of persisted) {
      // Reset transient in-flight states to a resumable state.
      if (item.status === 'uploading' || item.status === 'checking' || item.status === 'hashing' || item.status === 'optimizing') {
        item.status = item.hash ? 'queued' : 'queued';
      }
      this.items.set(item.id, item);
    }
    pruneDone().catch(() => {});

    // Android progressive enhancement: ask the SW to ping us on reconnect.
    this.registerBackgroundSync().catch(() => {});

    // If the SW tells us to resume, pump the queue.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if ((e.data as { type?: string })?.type === 'RESUME_UPLOADS') this.pump();
      });
    }

    this.emit();
    this.pump();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): EngineSnapshot {
    return {
      items: [...this.items.values()].sort((a, b) => a.createdAt - b.createdAt),
      online: this.online,
      activeCount: this.running.size,
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  private async persist(item: QueueItem) {
    if (this.disposed) return;
    item.updatedAt = Date.now();
    this.items.set(item.id, item);
    await putItem(item);
    this.emit();
  }

  private setStatus(item: QueueItem, status: UploadStatus, patch: Partial<QueueItem> = {}) {
    Object.assign(item, patch, { status });
    return this.persist(item);
  }

  /**
   * Add selected files to the queue. Dedups WITHIN the local queue by a cheap
   * (name,size) pre-check so re-selecting the same picture doesn't double-add
   * before hashing. Content-level dedup against the server happens later.
   */
  async addFiles(files: File[]): Promise<{ added: number; skipped: number }> {
    const guestId = await getGuestId();
    let added = 0;
    let skipped = 0;

    const existingKeys = new Set(
      [...this.items.values()]
        .filter((i) => i.status !== 'done')
        .map((i) => `${i.name}:${i.originalSize}`)
    );

    for (const file of files) {
      const name = sanitizeFilename(file.name);
      const key = `${name}:${file.size}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      existingKeys.add(key);

      const now = Date.now();
      const item: QueueItem = {
        id: cryptoId(),
        guestId,
        name,
        type: file.type || 'image/jpeg',
        size: file.size,
        originalSize: file.size,
        hash: null,
        blob: file, // replaced with optimized blob later
        thumbBlob: null,
        width: null,
        height: null,
        status: 'queued',
        progress: 0,
        attempts: 0,
        error: null,
        driveFileId: null,
        resumableUrl: null,
        bytesSent: 0,
        createdAt: now + added, // stable ordering
        updatedAt: now,
        duplicateResolution: null,
        existingFileId: null,
      };
      await this.persist(item);
      added++;
    }

    this.pump();
    return { added, skipped };
  }

  async retry(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    if (item.status === 'failed' || item.status === 'paused') {
      await this.setStatus(item, 'queued', { attempts: 0, error: null });
      this.pump();
    }
  }

  async retryAllFailed() {
    for (const item of this.items.values()) {
      if (item.status === 'failed') {
        item.attempts = 0;
        item.error = null;
        item.status = 'queued';
        await putItem(item);
      }
    }
    this.emit();
    this.pump();
  }

  async remove(id: string) {
    this.items.delete(id);
    this.running.delete(id);
    await deleteItem(id);
    this.emit();
    this.pump();
  }

  /** User answered the duplicate dialog. */
  async resolveDuplicate(id: string, choice: 'keep' | 'replace' | 'cancel') {
    const item = this.items.get(id);
    if (!item) return;
    if (choice === 'cancel') {
      await this.remove(id);
      return;
    }
    if (choice === 'keep') {
      // Keep existing: mark this one done without re-uploading.
      await this.setStatus(item, 'done', {
        progress: 1,
        driveFileId: item.existingFileId,
        duplicateResolution: 'keep',
      });
      this.pump();
      return;
    }
    // replace
    await this.setStatus(item, 'queued', { duplicateResolution: 'replace' });
    this.pump();
  }

  // ── Scheduler ──────────────────────────────────────────────────────────--
  private pump() {
    if (this.disposed) return;
    if (!this.online) {
      // Park actively-queued items visually as paused (don't lose them).
      this.emit();
      return;
    }
    for (const item of this.snapshot().items) {
      if (this.running.size >= this.cfg.concurrency) break;
      if (this.running.has(item.id)) continue;
      if (item.status === 'queued') {
        this.running.add(item.id);
        void this.process(item.id).finally(() => {
          this.running.delete(item.id);
          this.pump();
        });
      }
    }
  }

  private async process(id: string) {
    if (this.disposed) return;
    const item = this.items.get(id);
    if (!item) return;
    try {
      // 1. Optimize (idempotent: skip if we already have a hash+optimized blob).
      if (!item.hash) {
        await this.setStatus(item, 'optimizing');
        const opt = await optimizeImage(item.blob, DEFAULT_OPTIONS);
        item.blob = opt.uploadBlob;
        item.thumbBlob = opt.thumbBlob;
        item.type = opt.mime;
        item.size = opt.uploadBlob.size;
        item.width = opt.width;
        item.height = opt.height;

        // 2. Hash the bytes we will actually upload.
        await this.setStatus(item, 'hashing');
        item.hash = await sha256OfBlob(opt.uploadBlob);
        await this.persist(item);
      }

      // 3. Duplicate check (unless the user already chose replace).
      if (item.duplicateResolution !== 'replace') {
        await this.setStatus(item, 'checking');
        const dup = await checkDuplicate(item.hash!);
        if (dup.duplicate && item.duplicateResolution !== 'keep') {
          await this.setStatus(item, 'duplicate', {
            existingFileId: dup.existingFileId,
          });
          return; // wait for user via resolveDuplicate()
        }
      }

      // 4. Open (or reuse) a resumable session.
      await this.setStatus(item, 'uploading');
      if (!item.resumableUrl) {
        const init = await uploadInit({
          name: item.name,
          type: item.type,
          size: item.size,
          hash: item.hash!,
          width: item.width,
          height: item.height,
          replace: item.duplicateResolution === 'replace',
          existingFileId: item.existingFileId,
        });
        item.resumableUrl = init.resumableUrl;
        item.bytesSent = 0;
        await this.persist(item);
      }

      // 5. Upload chunks (resume from bytesSent).
      let fileId: string | null = item.driveFileId;
      while (item.bytesSent < item.size) {
        const end = Math.min(item.bytesSent + this.cfg.chunkSize, item.size);
        const chunk = item.blob.slice(item.bytesSent, end);
        const res = await uploadChunk({
          sessionId: item.resumableUrl!,
          chunk,
          start: item.bytesSent,
          total: item.size,
          onProgress: (loaded) => {
            item.progress = Math.min(0.98, loaded / item.size);
            this.emit();
          },
        });
        item.bytesSent = res.bytesCommitted;
        item.progress = Math.min(0.98, item.bytesSent / item.size);
        if (res.fileId) fileId = res.fileId;
        await this.persist(item);
        if (res.completed) break;
      }

      // 6. Finalize: upload thumbnail + confirm.
      if (fileId && item.thumbBlob) {
        await uploadThumbnail(fileId, item.thumbBlob);
      }
      await this.setStatus(item, 'done', { progress: 1, driveFileId: fileId });
    } catch (err) {
      await this.handleError(item, err);
    }
  }

  private async handleError(item: QueueItem, err: unknown) {
    item.attempts += 1;
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof ApiError ? err.status : 0;

    // Offline → park as paused, will auto-resume on reconnect (no attempt cost).
    if (!isOnline() || status === 0) {
      item.attempts -= 1; // don't burn attempts on pure network drops
      await this.setStatus(item, 'paused', { error: 'Waiting for connection' });
      return;
    }

    // 409 duplicate race from server → surface as duplicate.
    if (status === 409) {
      await this.setStatus(item, 'duplicate', { error: null });
      return;
    }

    if (item.attempts >= this.cfg.maxAttempts) {
      await this.setStatus(item, 'failed', { error: message });
      return;
    }

    // Backoff then requeue. Reset the resumable session only on 4xx (not 5xx),
    // because a 5xx may still allow resuming the same session.
    if (status >= 400 && status < 500) {
      item.resumableUrl = null;
      item.bytesSent = 0;
    }
    const delay = Math.min(
      this.cfg.backoffMax,
      this.cfg.backoffBase * 2 ** (item.attempts - 1)
    );
    const jitter = Math.random() * 0.3 * delay;
    await this.setStatus(item, 'queued', { error: message });
    setTimeout(() => this.pump(), delay + jitter);
  }

  private async registerBackgroundSync() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
    if (sync) {
      // Android/Chromium only; iOS silently lacks this — that's fine.
      await sync.register('bh-upload-resume').catch(() => {});
    }
  }
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Singleton.
export const uploadEngine = new UploadEngine();

// Exported for tests.
export { UploadEngine, CONCURRENCY, MAX_ATTEMPTS, CHUNK_SIZE };

// Re-export the getItem helper for consumers that need a fresh record.
export { getItem };
