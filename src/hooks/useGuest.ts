import { useEffect, useState } from 'react';
import { getGuestId, peekGuestId } from '../lib/guest';

export function useGuest(): string | null {
  const [id, setId] = useState<string | null>(() => peekGuestId());
  useEffect(() => {
    let active = true;
    getGuestId().then((g) => {
      if (active) setId(g);
    });
    return () => {
      active = false;
    };
  }, []);
  return id;
}
