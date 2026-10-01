import { useEffect, useState } from 'react';
import { uploadEngine, type EngineSnapshot } from '../lib/uploadEngine';

/** Subscribe a component to the live upload engine snapshot. */
export function useUploadQueue(): EngineSnapshot {
  const [snap, setSnap] = useState<EngineSnapshot>(() => uploadEngine.snapshot());
  useEffect(() => uploadEngine.subscribe(setSnap), []);
  return snap;
}
