import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGallery } from '../lib/api';
import type { PhotoRecord } from '../lib/types';

interface GalleryState {
  photos: PhotoRecord[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** Paginated, infinite-scroll-friendly gallery loader. */
export function useGallery(): GalleryState {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchGallery(reset ? null : tokenRef.current);
      tokenRef.current = page.nextPageToken;
      setHasMore(Boolean(page.nextPageToken));
      setPhotos((prev) => (reset ? page.photos : [...prev, ...page.photos]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the gallery');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const loadMore = useCallback(() => void load(false), [load]);
  const reload = useCallback(() => {
    tokenRef.current = null;
    setHasMore(true);
    void load(true);
  }, [load]);

  return { photos, loading, error, hasMore, loadMore, reload };
}
