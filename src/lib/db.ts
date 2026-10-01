// IndexedDB persistence layer.
//
// Two stores:
//  - 'queue': upload queue items (including the Blob bytes) so uploads survive
//    reloads, crashes and "browser closed → reopened".
//  - 'kv':    small key/value store (e.g. the guest id).
//
// We use the tiny `idb` wrapper for ergonomic promises.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QueueItem } from './types';

interface BHDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { byStatus: string; byCreatedAt: number };
  };
  kv: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'bricx-hannah-wedding';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BHDB>> | null = null;

function db(): Promise<IDBPDatabase<BHDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BHDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('queue')) {
          const store = database.createObjectStore('queue', { keyPath: 'id' });
          store.createIndex('byStatus', 'status');
          store.createIndex('byCreatedAt', 'createdAt');
        }
        if (!database.objectStoreNames.contains('kv')) {
          database.createObjectStore('kv');
        }
      },
    });
  }
  return dbPromise;
}

// ── Key/value helpers ───────────────────────────────────────────────────────
export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key) as Promise<T | undefined>;
}
export async function setKV(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}

// ── Queue helpers ─────────────────────────────────────────────────────────--
export async function putItem(item: QueueItem): Promise<void> {
  await (await db()).put('queue', item);
}

export async function getItem(id: string): Promise<QueueItem | undefined> {
  return (await db()).get('queue', id);
}

export async function deleteItem(id: string): Promise<void> {
  await (await db()).delete('queue', id);
}

export async function allItems(): Promise<QueueItem[]> {
  const items = await (await db()).getAllFromIndex('queue', 'byCreatedAt');
  return items;
}

/** Items for a given guest, newest first. */
export async function itemsForGuest(guestId: string): Promise<QueueItem[]> {
  const items = await allItems();
  return items.filter((i) => i.guestId === guestId).sort((a, b) => b.createdAt - a.createdAt);
}

/** Remove items that finished long ago to keep IDB small (keeps Blobs off disk). */
export async function pruneDone(olderThanMs = 1000 * 60 * 60 * 24 * 7): Promise<void> {
  const cutoff = Date.now() - olderThanMs;
  const items = await allItems();
  const database = await db();
  const tx = database.transaction('queue', 'readwrite');
  await Promise.all(
    items
      .filter((i) => i.status === 'done' && i.updatedAt < cutoff)
      .map((i) => tx.store.delete(i.id))
  );
  await tx.done;
}

/** Danger: wipe everything (used by "forget my data" in the UI). */
export async function clearAll(): Promise<void> {
  const database = await db();
  await database.clear('queue');
  await database.clear('kv');
}
