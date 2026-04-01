import { useState, useCallback, useEffect } from 'react';

export function useDiaryData() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async (year?: number, month?: number) => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && window.electron) {
        const result = await window.electron.ipcRenderer.invoke('diary:list', { year, month });
        // Assume result is an array of diary entries
        setEntries(result || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEntries = useCallback(async (query: string) => {
    if (typeof window !== 'undefined' && window.electron) {
      const result = await window.electron.ipcRenderer.invoke('diary:search', query);
      setEntries(result || []);
    }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  return { entries, loading, loadEntries, searchEntries };
}
