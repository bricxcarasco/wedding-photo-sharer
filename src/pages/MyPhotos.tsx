import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monogram } from '../components/Monogram';
import { OfflineBanner } from '../components/OfflineBanner';
import { Lightbox } from '../components/Lightbox';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { fetchMyPhotos } from '../lib/api';
import type { PhotoRecord } from '../lib/types';

export default function MyPhotos() {
  const nav = useNavigate();
  const { items } = useUploadQueue();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PhotoRecord | null>(null);

  // Live counts from the local queue (reflects in-progress + failed).
  const counts = useMemo(() => {
    const uploaded = items.filter((i) => i.status === 'done').length;
    const uploading = items.filter((i) =>
      ['uploading', 'optimizing', 'hashing', 'checking', 'queued', 'paused'].includes(i.status)
    ).length;
    const failed = items.filter((i) => i.status === 'failed').length;
    return { uploaded, uploading, failed };
  }, [items]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyPhotos()
      .then((p) => active && setPhotos(p))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [counts.uploaded]); // refetch when a new upload completes

  const total = photos.length;

  return (
    <main className="page">
      <OfflineBanner />
      <Monogram compact />

      <h2 style={{ marginTop: 18, fontSize: '1.6rem' }}>My Wedding Photos ❤️</h2>

      <div className="stat-row">
        <div className="stat">
          <b>{total || counts.uploaded}</b>
          <span>Uploaded</span>
        </div>
        <div className="stat">
          <b>{counts.uploading}</b>
          <span>In progress</span>
        </div>
        <div className="stat">
          <b>{counts.failed}</b>
          <span>Failed</span>
        </div>
      </div>

      <div className="action-grid" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => nav('/upload')}>
          <span className="emoji">📸</span> Upload more photos
        </button>
        {(counts.uploading > 0 || counts.failed > 0) && (
          <button className="btn ghost" onClick={() => nav('/upload-status')}>
            View upload status
          </button>
        )}
      </div>

      {loading && total === 0 ? (
        <div className="empty">
          <div className="big spin">⟳</div>
          <p>Loading your photos&hellip;</p>
        </div>
      ) : error ? (
        <div className="empty">
          <div className="big">😕</div>
          <p>{error}</p>
        </div>
      ) : total === 0 ? (
        <div className="empty">
          <div className="big">🤍</div>
          <p>No photos yet from this device.</p>
          <p style={{ fontSize: '0.78rem' }}>
            Photos are linked to this browser on this phone. If you switched
            devices or cleared your browser, earlier uploads may not appear here —
            but they&rsquo;re still safe in the shared gallery.
          </p>
        </div>
      ) : (
        <div className="masonry">
          {photos.map((p) => (
            <button
              key={p.id}
              className="tile mine"
              onClick={() => setActive(p)}
              aria-label={`Open ${p.name}`}
            >
              <img src={p.thumbnailUrl} alt={p.name} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {active && <Lightbox photo={active} onClose={() => setActive(null)} />}
    </main>
  );
}
