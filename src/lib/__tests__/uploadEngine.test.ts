import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────--
// Deterministic optimize: pass bytes through, tiny thumbnail.
vi.mock('../imageOptimize', async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    optimizeImage: vi.fn(async (blob: Blob) => ({
      uploadBlob: blob,
      thumbBlob: new Blob(['t']),
      width: 100,
      height: 100,
      mime: 'image/jpeg',
    })),
  };
});

// Hash based on blob text so same content => same hash.
vi.mock('../hash', () => ({
  sha256OfBlob: vi.fn(async (blob: Blob) => `hash_${await blob.text()}`),
}));

// Controllable API layer.
const api = {
  checkDuplicate: vi.fn(),
  uploadInit: vi.fn(),
  uploadChunk: vi.fn(),
  uploadThumbnail: vi.fn(),
};
vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      msg: string
    ) {
      super(msg);
    }
  },
  checkDuplicate: (...a: unknown[]) => api.checkDuplicate(...a),
  uploadInit: (...a: unknown[]) => api.uploadInit(...a),
  uploadChunk: (...a: unknown[]) => api.uploadChunk(...a),
  uploadThumbnail: (...a: unknown[]) => api.uploadThumbnail(...a),
}));

// Always online in tests.
vi.mock('../net', () => ({
  isOnline: () => true,
  onConnectivityChange: () => () => {},
  isSlowConnection: () => false,
}));

import { UploadEngine } from '../uploadEngine';
import { clearAll } from '../db';
import type { QueueItem } from '../types';

function fileOf(name: string, content: string): File {
  return new File([content], name, { type: 'image/jpeg' });
}

function waitFor(fn: () => boolean, timeout = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (fn()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('timeout waiting'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('UploadEngine', () => {
  let engine: UploadEngine = undefined as unknown as UploadEngine;

  beforeEach(async () => {
    if (engine) engine.dispose();
    await new Promise((r) => setTimeout(r, 0)); // let in-flight promises settle
    await clearAll();
    api.checkDuplicate.mockReset();
    api.uploadInit.mockReset();
    api.uploadChunk.mockReset();
    api.uploadThumbnail.mockReset();
    // Default happy-path mocks.
    api.checkDuplicate.mockResolvedValue({ duplicate: false, existingFileId: null, ownedByMe: false });
    api.uploadInit.mockResolvedValue({
      resumableUrl: 'sess-123',
      fileId: null,
      duplicate: false,
      existingFileId: null,
      ownedByMe: false,
    });
    api.uploadChunk.mockResolvedValue({ completed: true, fileId: 'drive-1', bytesCommitted: 999 });
    api.uploadThumbnail.mockResolvedValue(undefined);
    engine = new UploadEngine({
      maxAttempts: 2,
      backoffBase: 5,
      backoffMax: 20,
    });
    await engine.start();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('uploads a file through to done and confirms with the server', async () => {
    await engine.addFiles([fileOf('IMG_1.jpg', 'photo-one')]);
    await waitFor(() => engine.snapshot().items.some((i) => i.status === 'done'));
    const item = engine.snapshot().items[0];
    expect(item.status).toBe('done');
    expect(item.driveFileId).toBe('drive-1');
    expect(api.uploadThumbnail).toHaveBeenCalledWith('drive-1', expect.any(Blob));
  });

  it('dedups within the local queue by (name,size)', async () => {
    const { added, skipped } = await engine.addFiles([
      fileOf('SAME.jpg', 'xx'),
      fileOf('SAME.jpg', 'xx'),
    ]);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
  });

  it('pauses on a duplicate and waits for the user, then keep marks done without re-upload', async () => {
    api.checkDuplicate.mockResolvedValue({
      duplicate: true,
      existingFileId: 'existing-9',
      ownedByMe: true,
    });
    await engine.addFiles([fileOf('DUP.jpg', 'dup-bytes')]);
    await waitFor(() => engine.snapshot().items.some((i) => i.status === 'duplicate'));

    const dup = engine.snapshot().items[0];
    expect(dup.existingFileId).toBe('existing-9');
    expect(api.uploadInit).not.toHaveBeenCalled();

    await engine.resolveDuplicate(dup.id, 'keep');
    await waitFor(() => engine.snapshot().items[0]?.status === 'done');
    expect(engine.snapshot().items[0].driveFileId).toBe('existing-9');
    // "Keep" must NOT upload anything.
    expect(api.uploadInit).not.toHaveBeenCalled();
  });

  it('replace re-uploads after the user chooses replace', async () => {
    api.checkDuplicate.mockResolvedValue({
      duplicate: true,
      existingFileId: 'existing-9',
      ownedByMe: true,
    });
    await engine.addFiles([fileOf('DUP2.jpg', 'dup-bytes-2')]);
    await waitFor(() => engine.snapshot().items.some((i) => i.status === 'duplicate'));
    const dup = engine.snapshot().items[0];

    await engine.resolveDuplicate(dup.id, 'replace');
    await waitFor(() => engine.snapshot().items[0]?.status === 'done');
    expect(api.uploadInit).toHaveBeenCalledTimes(1);
    expect(api.uploadInit).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });

  it('surfaces a server error as failed, then succeeds on manual retry', async () => {
    // One hard failure (4xx so it does not consume long backoff on the first
    // pass) — but to avoid flaky timing we drive it to failed via repeated
    // rejects and poll with a generous timeout, then flip to success.
    const { ApiError } = await import('../api');
    api.uploadInit.mockRejectedValue(new ApiError(400, 'bad request'));

    await engine.addFiles([fileOf('FAIL.jpg', 'fail-bytes')]);
    await waitFor(
      () => engine.snapshot().items.some((i: QueueItem) => i.status === 'failed'),
      5000
    );
    expect(engine.snapshot().items[0].status).toBe('failed');

    // Allow success and retry.
    api.uploadInit.mockResolvedValue({
      resumableUrl: 'sess-ok',
      fileId: null,
      duplicate: false,
      existingFileId: null,
      ownedByMe: false,
    });
    const id = engine.snapshot().items[0].id;
    await engine.retry(id);
    await waitFor(() => engine.snapshot().items[0]?.status === 'done', 5000);
    expect(engine.snapshot().items[0].status).toBe('done');
  }, 15000);
});
