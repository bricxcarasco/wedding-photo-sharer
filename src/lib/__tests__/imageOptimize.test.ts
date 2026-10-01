import { describe, expect, it } from 'vitest';
import { fitWithin } from '../imageOptimize';

describe('fitWithin', () => {
  it('does not upscale smaller images', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });
  it('scales down preserving aspect ratio (landscape)', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
  });
  it('scales down preserving aspect ratio (portrait)', () => {
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });
  it('handles square', () => {
    expect(fitWithin(5000, 5000, 1000)).toEqual({ width: 1000, height: 1000 });
  });
  it('is defensive against zero dimensions', () => {
    expect(fitWithin(0, 0, 500)).toEqual({ width: 500, height: 500 });
  });
});
