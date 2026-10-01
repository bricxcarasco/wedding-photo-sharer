// Online/offline awareness + a tiny pub/sub so the engine and UI can react.

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function onConnectivityChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function broadcast() {
  const o = isOnline();
  for (const l of listeners) l(o);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', broadcast);
  window.addEventListener('offline', broadcast);
}

/** True on connection types the UA flags as very slow, when available. */
export function isSlowConnection(): boolean {
  const c = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } })
    .connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}
