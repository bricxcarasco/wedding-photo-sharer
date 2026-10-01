// Runtime capability detection, so we build around ACTUAL support (section 22).

export interface Capabilities {
  // Hard requirements for the app to function at all.
  usable: boolean;
  // Individual features (for progressive enhancement / messaging).
  indexedDB: boolean;
  serviceWorker: boolean;
  backgroundSync: boolean; // Android/Chromium only; iOS Safari = false
  liveCamera: boolean; // getUserMedia
  nativeCameraInput: boolean; // <input capture> — iOS/Android both support
  webpEncode: boolean;
  offscreenCanvas: boolean;
  notifications: boolean;
  secureContext: boolean;
}

export function detectCapabilities(): Capabilities {
  const hasFetch = typeof fetch === 'function';
  const hasBlob = typeof Blob !== 'undefined';
  const hasFile = typeof File !== 'undefined';
  const indexedDB = typeof window !== 'undefined' && 'indexedDB' in window;
  const serviceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const backgroundSync =
    serviceWorker && typeof window !== 'undefined' && 'SyncManager' in window;
  const liveCamera =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';
  const offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const notifications = typeof window !== 'undefined' && 'Notification' in window;
  const secureContext = typeof window !== 'undefined' ? window.isSecureContext : true;

  let webpEncode = false;
  try {
    const c = document.createElement('canvas');
    webpEncode = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpEncode = false;
  }

  // The app needs fetch + Blob + File to select and send photos. IndexedDB is
  // strongly preferred (persistent queue) but we degrade to in-memory if absent.
  const usable = hasFetch && hasBlob && hasFile;

  return {
    usable,
    indexedDB,
    serviceWorker,
    backgroundSync,
    liveCamera,
    nativeCameraInput: hasFile,
    webpEncode,
    offscreenCanvas,
    notifications,
    secureContext,
  };
}
