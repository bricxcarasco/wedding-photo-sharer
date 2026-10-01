import { useEffect, useState } from 'react';
import type { QueueItem } from '../lib/types';
import { formatBytes } from '../lib/format';

const STATUS_META: Record<QueueItem['status'], { icon: string; label: string; spin?: boolean }> = {
  queued: { icon: '⏳', label: 'Waiting' },
  optimizing: { icon: '🪄', label: 'Preparing' },
  hashing: { icon: '🔎', label: 'Checking' },
  checking: { icon: '🔎', label: 'Checking' },
  duplicate: { icon: '❓', label: 'Already uploaded?' },
  uploading: { icon: '⟳', label: 'Uploading', spin: true },
  done: { icon: '✓', label: 'Uploaded' },
  failed: { icon: '⚠', label: 'Failed' },
  paused: { icon: '⏸', label: 'Paused' },
};

interface Props {
  item: QueueItem;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  onResolveDuplicate?: (id: string) => void;
}

export function QueueRow({ item, onRetry, onRemove, onResolveDuplicate }: Props) {
  const meta = STATUS_META[item.status];
  const thumbUrl = useObjectUrl(item.thumbBlob ?? (item.status === 'queued' ? item.blob : null));

  return (
    <div className="q-row">
      {thumbUrl ? (
        <img className="q-thumb" src={thumbUrl} alt="" />
      ) : (
        <div className="q-thumb" aria-hidden="true" />
      )}
      <div className="q-main">
        <div className="q-name">{item.name}</div>
        <div className="q-sub">
          {meta.label}
          {item.status === 'uploading' && ` ${Math.round(item.progress * 100)}%`}
          {item.status !== 'uploading' && item.status !== 'done' && item.size
            ? ` · ${formatBytes(item.size)}`
            : ''}
          {item.status === 'failed' && item.error ? ` · ${item.error}` : ''}
        </div>
        {item.status === 'uploading' && (
          <div className="progress" style={{ marginTop: 6 }}>
            <i style={{ width: `${Math.round(item.progress * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="q-status" aria-hidden="true">
        <span className={meta.spin ? 'spin' : undefined}>{meta.icon}</span>
      </div>
      {item.status === 'failed' && onRetry && (
        <button className="btn ghost" style={{ width: 'auto' }} onClick={() => onRetry(item.id)}>
          Retry
        </button>
      )}
      {item.status === 'duplicate' && onResolveDuplicate && (
        <button
          className="btn ghost"
          style={{ width: 'auto' }}
          onClick={() => onResolveDuplicate(item.id)}
        >
          Review
        </button>
      )}
      {(item.status === 'failed' || item.status === 'paused') && onRemove && (
        <button
          className="btn ghost"
          style={{ width: 'auto' }}
          aria-label={`Remove ${item.name}`}
          onClick={() => onRemove(item.id)}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Create and revoke an object URL for a blob. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
