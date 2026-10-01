import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '../http';
import { parseContentRange, isValidDriveFileId, sanitizeServerName } from '../validate';

describe('signSession / verifySession', () => {
  it('round-trips a valid session bound to a guest', () => {
    const token = signSession({ url: 'https://drive/session/x', guestId: 'guest_abc123def456' });
    const parsed = verifySession(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.url).toBe('https://drive/session/x');
    expect(parsed?.guestId).toBe('guest_abc123def456');
  });

  it('rejects a tampered payload', () => {
    const token = signSession({ url: 'https://drive/session/x', guestId: 'guest_a' });
    const [body, mac] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ url: 'https://evil/', guestId: 'guest_a', exp: Date.now() + 100000 })
    ).toString('base64url');
    expect(verifySession(`${forgedBody}.${mac}`)).toBeNull();
    // Original still valid (sanity).
    expect(verifySession(`${body}.${mac}`)).not.toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('nodot')).toBeNull();
    expect(verifySession('a.b')).toBeNull();
  });
});

describe('parseContentRange', () => {
  it('parses a valid range', () => {
    expect(parseContentRange('bytes 0-1048575/5242880')).toEqual({
      start: 0,
      end: 1048575,
      total: 5242880,
    });
  });
  it('rejects malformed or out-of-bounds ranges', () => {
    expect(parseContentRange(undefined)).toBeNull();
    expect(parseContentRange('bytes 10-5/100')).toBeNull(); // end < start
    expect(parseContentRange('bytes 0-100/100')).toBeNull(); // end >= total
    expect(parseContentRange('nonsense')).toBeNull();
  });
});

describe('isValidDriveFileId', () => {
  it('accepts realistic ids and rejects injection', () => {
    expect(isValidDriveFileId('1a2B3c4D5e6F_g-h')).toBe(true);
    expect(isValidDriveFileId("'; DROP")).toBe(false);
    expect(isValidDriveFileId('short')).toBe(false);
  });
});

describe('sanitizeServerName', () => {
  it('strips newlines and path chars', () => {
    expect(sanitizeServerName('a\n/b\\c.jpg')).toBe('a -b-c.jpg');
  });
  it('falls back when empty', () => {
    expect(sanitizeServerName('')).toBe('photo.jpg');
  });
});
