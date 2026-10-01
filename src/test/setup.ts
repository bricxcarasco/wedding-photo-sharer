import 'fake-indexeddb/auto';

// Provide a real crypto.subtle for jsdom if missing (Node has webcrypto).
import { webcrypto } from 'node:crypto';

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.crypto === 'undefined' || !(g.crypto as Crypto)?.subtle) {
  g.crypto = webcrypto as unknown as Crypto;
}

// jsdom's Blob/File can lack a correct arrayBuffer()/text() in some versions.
// Polyfill them so hashing tests exercise the real SHA-256 code path on
// correct bytes. We cast the prototype to a loose record to avoid build-time
// type friction (these shims only matter in the jsdom test environment).
const blobProto = (typeof Blob !== 'undefined' ? Blob.prototype : null) as
  | (Blob & Record<string, unknown>)
  | null;

if (blobProto && typeof blobProto.arrayBuffer !== 'function') {
  blobProto.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
if (blobProto && typeof blobProto.text !== 'function') {
  blobProto.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
