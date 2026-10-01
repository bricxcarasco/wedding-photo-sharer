import { useOnline } from '../hooks/useOnline';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="banner offline" role="status">
      <span aria-hidden="true">📶</span>
      <span>
        You&rsquo;re offline. Your photos are safely waiting and will upload when
        your connection returns.
      </span>
    </div>
  );
}
