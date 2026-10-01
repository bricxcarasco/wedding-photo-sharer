// Anonymous guest identity. No PII, ever.
//
// Primary store: IndexedDB (durable). Mirror: localStorage (fast sync read and
// survives some IndexedDB eviction). If both are empty we mint a fresh id.
//
// Honest limitation: clearing site data, Private/Incognito mode, a different
// browser, or a different device all produce a NEW id — the previous uploads
// are then not linkable to "My Photos". The UI states this plainly.

import { getKV, setKV } from './db';

const LS_KEY = 'bh.guestId';
const DB_KEY = 'guestId';

let cached: string | null = null;

function mintId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : // Fallback for very old engines.
        'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `guest_${uuid.replace(/-/g, '')}`;
}

/** Resolve the stable guest id, creating and persisting one on first visit. */
export async function getGuestId(): Promise<string> {
  if (cached) return cached;

  // Fast path: localStorage mirror.
  let id: string | null = null;
  try {
    id = localStorage.getItem(LS_KEY);
  } catch {
    /* storage blocked (e.g. some privacy modes) */
  }

  // Durable path: IndexedDB.
  if (!id) {
    try {
      id = (await getKV<string>(DB_KEY)) ?? null;
    } catch {
      /* ignore */
    }
  }

  if (!id) id = mintId();

  // Persist to both stores (best effort).
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    /* ignore */
  }
  try {
    await setKV(DB_KEY, id);
  } catch {
    /* ignore */
  }

  cached = id;
  return id;
}

/** Synchronous best-effort read for render paths that can't await. */
export function peekGuestId(): string | null {
  if (cached) return cached;
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}
