import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Monogram } from '../components/Monogram';
import { OfflineBanner } from '../components/OfflineBanner';
import { CameraCapture } from '../components/CameraCapture';
import { QueueRow } from '../components/QueueRow';
import { DuplicateDialog } from '../components/DuplicateDialog';
import { useToast } from '../components/Toast';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { uploadEngine } from '../lib/uploadEngine';

const liveCameraSupported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

export default function Upload() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { items } = useUploadQueue();

  const [showCamera, setShowCamera] = useState(params.get('camera') === '1');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const nativeCameraInput = useRef<HTMLInputElement | null>(null);

  const pendingDuplicate = useMemo(
    () => items.find((i) => i.status === 'duplicate'),
    [items]
  );

  const recent = useMemo(
    () => items.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [items]
  );

  // Stable callbacks so memoized QueueRows don't re-render on every emit.
  const handleRetry = useCallback((id: string) => void uploadEngine.retry(id), []);
  const handleRemove = useCallback((id: string) => void uploadEngine.remove(id), []);
  const handleResolveDuplicate = useCallback(() => {
    /* handled by the dialog below */
  }, []);

  async function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) {
      toast.show('Those files are not photos.', 'error');
      return;
    }
    const { added, skipped } = await uploadEngine.addFiles(arr);
    if (added) toast.show(`${added} photo${added === 1 ? '' : 's'} added to the upload queue.`, 'success');
    if (skipped) toast.show(`${skipped} already in the queue — skipped.`, 'info');
  }

  return (
    <main className="page">
      <OfflineBanner />
      <Monogram compact />

      {showCamera && liveCameraSupported ? (
        <div className="card" style={{ marginTop: 16 }}>
          <CameraCapture
            onCapture={(file) => void addFiles([file])}
            onClose={() => setShowCamera(false)}
          />
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', marginTop: 10 }}>
            Tap the shutter as many times as you like — photos upload in the
            background while you keep shooting.
          </p>
        </div>
      ) : (
        <div className="action-grid" style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={() => {
              if (liveCameraSupported) setShowCamera(true);
              else nativeCameraInput.current?.click();
            }}
          >
            <span className="emoji">📸</span> Take a Photo
          </button>
          <button className="btn secondary" onClick={() => fileInput.current?.click()}>
            <span className="emoji">🖼️</span> Choose Photos
          </button>
        </div>
      )}

      {/* Multi-select from library */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {/* Native camera fallback for browsers without getUserMedia */}
      <input
        ref={nativeCameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {recent.length > 0 && (
        <section className="card" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem' }}>Recent uploads</h3>
            <button className="btn ghost" style={{ width: 'auto' }} onClick={() => nav('/upload-status')}>
              See all
            </button>
          </div>
          <div>
            {recent.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onRetry={handleRetry}
                onRemove={handleRemove}
                onResolveDuplicate={handleResolveDuplicate}
              />
            ))}
          </div>
        </section>
      )}

      {pendingDuplicate && (
        <DuplicateDialog
          item={pendingDuplicate}
          onChoose={(choice) => void uploadEngine.resolveDuplicate(pendingDuplicate.id, choice)}
        />
      )}
    </main>
  );
}
