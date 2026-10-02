import { useEffect } from 'react';
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

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {/* Full view still uses the thumbnail proxy (web-sized), never the raw
          original, to keep bandwidth sane. The image fills the whole screen
          (background-size: cover), perfectly centered both ways. */}
      <div
        className="lightbox-image"
        role="img"
        aria-label={photo.name}
        style={{ backgroundImage: `url(${photo.thumbnailUrl})` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
