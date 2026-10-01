import { COUPLE, WEDDING_DATE_LABEL } from '../lib/config';

/** The couple's names + date — the recurring brand mark. */
export function Monogram({ compact = false }: { compact?: boolean }) {
  const [first, second] = COUPLE.split('&').map((s) => s.trim());
  return (
    <header className="monogram">
      <h1 className="names" style={compact ? { fontSize: '1.9rem' } : undefined}>
        {first} <span className="amp">&amp;</span> {second}
      </h1>
      <div className="date">{WEDDING_DATE_LABEL}</div>
      {!compact && <div className="flourish" aria-hidden="true" />}
    </header>
  );
}
