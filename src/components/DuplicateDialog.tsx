import type { QueueItem } from '../lib/types';

interface Props {
  item: QueueItem;
  onChoose: (choice: 'keep' | 'replace' | 'cancel') => void;
}

/** Shown when the server reports a photo with the same content hash exists. */
export function DuplicateDialog({ item, onChoose }: Props) {
  const canReplace = item.existingFileId != null;
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Duplicate photo">
      <div className="sheet">
        <h3>This photo looks familiar 💭</h3>
        <p>
          &ldquo;{item.name}&rdquo; appears to have already been uploaded. What
          would you like to do?
        </p>
        <button className="btn secondary" onClick={() => onChoose('keep')}>
          Keep the existing photo
        </button>
        {canReplace && (
          <button className="btn" onClick={() => onChoose('replace')}>
            Replace with this one
          </button>
        )}
        <button className="btn ghost" onClick={() => onChoose('cancel')}>
          Cancel this upload
        </button>
      </div>
    </div>
  );
}
