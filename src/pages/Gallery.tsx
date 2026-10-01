import { useEffect, useRef, useState } from 'react';
import { Monogram } from '../components/Monogram';
import { OfflineBanner } from '../components/OfflineBanner';
import { Lightbox } from '../components/Lightbox';
import { useGallery } from '../hooks/useGallery';
import type { PhotoRecord } from '../lib/types';

export default function Gallery() {
  const { photos, loading, error, hasMore, loadMore, reload } = useGallery();
  const [active, setActive] = useState<PhotoRecord | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Infinite scroll via IntersectionObserver.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) loadMore();
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <main className="page">
      <OfflineBanner />
      <Monogram />
      <h2 style={{ textAlign: 'center', fontSize: '1.5rem', marginTop: 4 }}>
        ✨ Our Wedding Gallery
      </h2>
      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.84rem', marginBottom: 14 }}>
        Every photo shared by our wonderful guests.
      </p>

      {error && photos.length === 0 ? (
        <div className="empty">
          <div className="big">😕</div>
          <p>{error}</p>
          <button className="btn secondary" style={{ maxWidth: 240, margin: '12px auto 0' }} onClick={reload}>
            Try again
          </button>
        </div>
      ) : photos.length === 0 && !loading ? (
        <div className="empty">
          <div className="big">📸</div>
          <p>No photos yet — be the first to share one!</p>
        </div>
      ) : (
        <div className="masonry">
          {photos.map((p) => (
            <button
              key={p.id}
              className={`tile ${p.mine ? 'mine' : ''}`}
              onClick={() => setActive(p)}
              aria-label={`Open photo ${p.name}`}
            >
              <img src={p.thumbnailUrl} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      <div ref={sentinel} style={{ height: 1 }} />

      {loading && (
        <div className="empty">
          <div className="big spin">⟳</div>
        </div>
      )}
      {!loading && hasMore && photos.length > 0 && (
        <button className="btn secondary" style={{ margin: '12px auto', maxWidth: 240 }} onClick={loadMore}>
          Load more
        </button>
      )}

      {active && <Lightbox photo={active} onClose={() => setActive(null)} />}
    </main>
  );
}
