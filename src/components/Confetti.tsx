import { useMemo } from 'react';

// Continuous, gentle falling confetti of wedding glyphs. Pure CSS animation
// (no canvas, no rAF loop) so it's cheap and keeps running across all pages.
// Honors prefers-reduced-motion via the CSS (the whole layer is hidden there).

const GLYPHS = ['💗', '💍', '💎', '🌿', '🤍', '🍃', '✨'];

interface Piece {
  id: number;
  glyph: string;
  left: number; // vw
  delay: number; // s
  duration: number; // s
  size: number; // rem
  drift: number; // px horizontal sway
  rotate: number; // deg
  opacity: number;
}

function buildPieces(count: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      glyph: GLYPHS[i % GLYPHS.length],
      left: Math.random() * 100,
      delay: -Math.random() * 14, // negative = already mid-fall on load
      duration: 9 + Math.random() * 9,
      size: 0.55 + Math.random() * 0.6,
      drift: (Math.random() * 2 - 1) * 40,
      rotate: (Math.random() * 2 - 1) * 220,
      opacity: 0.5 + Math.random() * 0.4,
    });
  }
  return pieces;
}

/**
 * Decorative confetti layer. Rendered once at the app root; pointer-events are
 * disabled so it never blocks taps.
 */
export function Confetti({ count = 22 }: { count?: number }) {
  const pieces = useMemo(() => buildPieces(count), [count]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          style={
            {
              left: `${p.left}vw`,
              fontSize: `${p.size}rem`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.rotate}deg`,
            } as React.CSSProperties
          }
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}
