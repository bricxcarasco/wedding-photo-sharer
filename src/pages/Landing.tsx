import { useNavigate } from 'react-router-dom';
import { Monogram } from '../components/Monogram';
import { OfflineBanner } from '../components/OfflineBanner';
import { useUploadQueue } from '../hooks/useUploadQueue';

export default function Landing() {
  const nav = useNavigate();
  const { items } = useUploadQueue();
  const active = items.filter(
    (i) => i.status !== 'done' && i.status !== 'failed'
  ).length;

  return (
    <main className="page">
      <OfflineBanner />
      <div style={{ marginTop: 24 }}>
        <Monogram />
      </div>

      <p style={{ textAlign: 'center', color: 'var(--ink-soft)', margin: '6px 0 2px' }}>
        Welcome! Help us remember today by sharing your photos. 💐
      </p>

      <div className="action-grid">
        <button className="btn" onClick={() => nav('/upload?camera=1')}>
          <span className="emoji">📸</span> Take a Photo
        </button>
        <button className="btn secondary" onClick={() => nav('/upload')}>
          <span className="emoji">🖼️</span> Upload Photos
        </button>
        <button className="btn secondary" onClick={() => nav('/photos')}>
          <span className="emoji">💕</span> My Photos
        </button>
        <button className="btn gold" onClick={() => nav('/gallery')}>
          <span className="emoji">✨</span> Wedding Gallery
        </button>
      </div>

      {active > 0 && (
        <button
          className="btn ghost"
          style={{ marginTop: 16 }}
          onClick={() => nav('/upload-status')}
        >
          ⟳ {active} photo{active === 1 ? '' : 's'} uploading — view status
        </button>
      )}

      <p
        style={{
          textAlign: 'center',
          color: 'var(--ink-soft)',
          fontSize: '0.76rem',
          marginTop: 28,
        }}
      >
        No sign-up needed. Your photos are linked to this device so you can find
        them again under &ldquo;My Photos&rdquo;.
      </p>
    </main>
  );
}
