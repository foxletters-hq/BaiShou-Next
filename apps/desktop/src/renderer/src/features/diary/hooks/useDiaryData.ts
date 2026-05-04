import { useState, useCallback, useEffect } from 'react';
import { logger } from '@baishou/shared';

export function useDiaryData() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const api = (window as any).api;
      if (api?.diary?.listAll) {
        const result = await api.diary.listAll();
        setEntries(result || []);
      } else if (typeof window !== 'undefined' && (window as any).electron) {
        // Fallback to raw IPC
        const result = await (window as any).electron.ipcRenderer.invoke('diary:listAll');
        setEntries(result || []);
      }
    } catch (err) {
      logger.error('Failed to load diary entries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEntries = useCallback(async (query: string) => {
    try {
      const api = (window as any).api;
      if (api?.diary?.search) {
        const result = await api.diary.search(query);
        setEntries(result || []);
      }
    } catch (err) {
      logger.error('Failed to search diary entries:', err);
    }
  }, []);

  useEffect(() => { 
    loadEntries(); 
    
    const api = (window as any).api;
    let unsubscribe: (() => void) | undefined;
    
    if (api?.diary?.onSyncEvent) {
      unsubscribe = api.diary.onSyncEvent((eventData: any) => {
        logger.info('[useDiaryData] 🔔 收到 diary:sync-event，立刻静默刷新', eventData);
        const fetchSilently = async () => {
          try {
            const apiRef = (window as any).api;
            if (apiRef?.diary?.listAll) {
              const result = await apiRef.diary.listAll();
              logger.info('[useDiaryData] ✅ 静默刷新完成，条数:', result?.length);
              setEntries(result || []);
            }
          } catch (err) {
            logger.error('[useDiaryData] 静默刷新失败:', err);
          }
        };
        fetchSilently();
      });
    } else {
      logger.warn('[useDiaryData] ⚠️ api.diary.onSyncEvent 不存在，无法订阅文件变动事件');
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadEntries]);

  return { entries, loading, loadEntries, searchEntries };
}
