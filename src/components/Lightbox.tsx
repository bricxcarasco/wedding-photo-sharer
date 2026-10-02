import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PhotoRecord } from '../lib/types';

interface Props {
  photo: PhotoRecord;
  onClose: () => void;
}

export function Lightbox({ photo, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Render into document.body via a portal. CRITICAL: the page container
  // (`.page`) has an animated `transform` (fade-up), which establishes a
  // containing block — so a `position: fixed` child would be positioned
  // relative to `.page` (a scrollable, max-width box) instead of the viewport,
  // trapping the preview inside the grid. The portal lifts the overlay out to
  // <body> so `position: fixed` resolves against the real viewport.
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {/* Full-screen modal: dark backdrop + the whole image shown (object-fit:
          contain), centered, inset by a small gap. Tap the backdrop or ✕ to
          close and return to the photo list. Still uses the thumbnail proxy
          (web-sized), never the raw original, to keep bandwidth sane. */}
      <img
        className="lightbox-image"
        src={photo.thumbnailUrl}
        alt={photo.name}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
