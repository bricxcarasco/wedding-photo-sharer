import { useNavigate } from 'react-router-dom';
import { Monogram } from '../../components/Monogram';

interface Props {
  emoji?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Reusable friendly error / empty screen used by the fallback routes. */
export function ErrorState({ emoji = '💐', title, message, actionLabel, onAction }: Props) {
  const nav = useNavigate();
  return (
    <main className="page">
      <Monogram compact />
      <div className="empty" role="alert">
        <div className="big">{emoji}</div>
        <h2 style={{ fontSize: '1.4rem', margin: '8px 0' }}>{title}</h2>
        <p>{message}</p>
      </div>
      <div className="action-grid">
        {actionLabel && onAction && (
          <button className="btn" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button className="btn secondary" onClick={() => nav('/')}>
          Back to home
        </button>
      </div>
    </main>
  );
}
