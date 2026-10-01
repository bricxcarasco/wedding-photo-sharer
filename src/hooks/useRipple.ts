import { useEffect } from 'react';

// Global tap-ripple: on pointerdown anywhere on an interactive element
// (.btn / .tile / .shutter / [data-ripple]), spawn a short-lived ripple span
// positioned at the touch point. One delegated listener for the whole app, so
// it works on every button/tile without wiring each one.
//
// Respects prefers-reduced-motion (skips entirely).

const SELECTOR = '.btn, .tile, .shutter, [data-ripple]';

export function useRipple(): void {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const host = target?.closest<HTMLElement>(SELECTOR);
      if (!host) return;
      // Disabled controls shouldn't ripple.
      if ((host as HTMLButtonElement).disabled) return;

      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

      // Ensure the host can contain the absolutely-positioned ripple.
      const cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
      if (cs.overflow === 'visible') host.style.overflow = 'hidden';

      host.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      // Safety cleanup in case animationend doesn't fire.
      setTimeout(() => ripple.remove(), 800);
    };

    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
}
