import { useEffect, useState } from 'react';
import { useAppStore } from './useAppStore';
import { useDbStore } from '../lib/db';

export function useOnlineStatus() {
  const { setIsOnline } = useAppStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);
}

// React custom query hook that re-runs when Firestore snapshots update our Zustand state version
export function useDexieQuery<T>(queryFn: () => Promise<T> | T, deps: any[] = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  const dbVersion = useDbStore((state) => state.version);

  useEffect(() => {
    let isMounted = true;
    const runQuery = async () => {
      try {
        const result = await queryFn();
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        console.error('[useDexieQuery] Query evaluation failed:', err);
      }
    };
    runQuery();
    return () => {
      isMounted = false;
    };
  }, [dbVersion, ...deps]);

  return data;
}
