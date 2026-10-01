import { describe, expect, it } from 'vitest';
import { bufferToHex, sha256OfBlob, weakHash } from '../hash';

describe('sha256OfBlob', () => {
  it('matches the known SHA-256 of "abc"', async () => {
    // SHA-256("abc") is a well-known test vector.
    const hash = await sha256OfBlob(new Blob(['abc']));
    expect(hash).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
  it('is deterministic and content-based (not name-based)', async () => {
    const a = await sha256OfBlob(new Blob(['identical bytes']));
    const b = await sha256OfBlob(new Blob(['identical bytes']));
    const c = await sha256OfBlob(new Blob(['different bytes']));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('bufferToHex', () => {
  it('zero-pads bytes', () => {
    expect(bufferToHex(new Uint8Array([0, 15, 255]).buffer)).toBe('000fff');
  });
});

describe('weakHash fallback', () => {
  it('differs for different content', () => {
    expect(weakHash(new TextEncoder().encode('a').buffer)).not.toBe(
      weakHash(new TextEncoder().encode('b').buffer)
    );
  });
});
