import { useState, useEffect, useCallback } from 'react';

export function useSummaryData() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    totalDiaryCount: 0, 
    totalWeeklyCount: 0, 
    totalMonthlyCount: 0, 
    totalQuarterlyCount: 0, 
    totalYearlyCount: 0 
  });
  const [missingSummaries, setMissingSummaries] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      Promise.all([
        window.electron.ipcRenderer.invoke('summary:list'),
        window.electron.ipcRenderer.invoke('summary:stats'),
        window.electron.ipcRenderer.invoke('summary:detect-missing'),
      ]).then(([list, st, missing]) => {
        setSummaries(list || []);
        setStats({
          totalDiaryCount: st?.totalDiaryCount || 0,
          totalWeeklyCount: st?.weeklyCount || 0,
          totalMonthlyCount: st?.monthlyCount || 0,
          totalQuarterlyCount: st?.quarterlyCount || 0,
          totalYearlyCount: st?.yearlyCount || 0
        });
        setMissingSummaries(missing || []);
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateSummary = async (type: string, dateRange: any) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:generate', { type, dateRange });
    }
  };

  return { summaries, stats, missingSummaries, setMissingSummaries, generateSummary, refreshData: fetchData };
}
