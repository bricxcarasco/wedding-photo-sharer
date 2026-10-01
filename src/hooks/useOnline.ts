import { useEffect, useState } from 'react';
import { isOnline, onConnectivityChange } from '../lib/net';

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => onConnectivityChange(setOnline), []);
  return online;
}
