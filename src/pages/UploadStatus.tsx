import { useMemo } from 'react';
import { Monogram } from '../components/Monogram';
import { OfflineBanner } from '../components/OfflineBanner';
import { QueueRow } from '../components/QueueRow';
import { DuplicateDialog } from '../components/DuplicateDialog';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { uploadEngine } from '../lib/uploadEngine';

export default function UploadStatus() {
  const { items } = useUploadQueue();

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    const active = items.filter(
      (i) => !['done', 'failed'].includes(i.status)
    ).length;
    return { done, failed, active, total: items.length };
  }, [items]);

  const pendingDuplicate = items.find((i) => i.status === 'duplicate');
  const ordered = items.slice().sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="page">
      <OfflineBanner />
      <Monogram compact />

      <h2 style={{ marginTop: 18, fontSize: '1.5rem' }}>Uploading your photos</h2>

      {stats.total === 0 ? (
        <div className="empty">
          <div className="big">📷</div>
          <p>Nothing in the queue yet.</p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <b>{stats.done}</b>
              <span>Uploaded</span>
            </div>
            <div className="stat">
              <b>{stats.active}</b>
              <span>In progress</span>
            </div>
            <div className="stat">
              <b>{stats.failed}</b>
              <span>Failed</span>
            </div>
          </div>

          <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
            {stats.done} / {stats.total} photos uploaded
            {stats.active === 0 && stats.failed === 0 && stats.done > 0
              ? ' — all done! ❤️'
              : ''}
          </p>

          {stats.failed > 0 && (
            <button
              className="btn secondary"
              style={{ margin: '8px 0 14px' }}
              onClick={() => void uploadEngine.retryAllFailed()}
            >
              Retry {stats.failed} failed upload{stats.failed === 1 ? '' : 's'}
            </button>
          )}

          <section className="card">
            {ordered.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onRetry={(id) => void uploadEngine.retry(id)}
                onRemove={(id) => void uploadEngine.remove(id)}
                onResolveDuplicate={() => {
                  /* dialog below */
                }}
              />
            ))}
          </section>

          <p style={{ color: 'var(--ink-soft)', fontSize: '0.76rem', marginTop: 14 }}>
            Uploads continue while you move around the app. If you close the
            browser they&rsquo;ll pause and pick up again when you reopen this
            page on this device.
          </p>
        </>
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
