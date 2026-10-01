import { describe, expect, it } from 'vitest';
import { formatBytes, sanitizeFilename } from '../format';

describe('formatBytes', () => {
  it('handles zero and negatives', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });
  it('formats common sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators and reserved chars', () => {
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFilename('a<b>c:"d"|e?f*g')).toBe('abcdefg');
  });
  it('never returns empty', () => {
    expect(sanitizeFilename('')).toBe('photo.jpg');
    expect(sanitizeFilename('   ')).toBe('photo.jpg');
  });
  it('caps length', () => {
    expect(sanitizeFilename('x'.repeat(500)).length).toBeLessThanOrEqual(120);
  });
  it('collapses whitespace', () => {
    expect(sanitizeFilename('my   photo .jpg')).toBe('my photo .jpg');
  });
});
