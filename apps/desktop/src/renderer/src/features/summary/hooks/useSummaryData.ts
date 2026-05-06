import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@baishou/shared';

export function useSummaryData() {
  const { i18n } = useTranslation();
  const [summaries, setSummaries] = useState<any[]>([]);
  const [stats, setStats] = useState({ 
    totalDiaryCount: 0, 
    totalWeeklyCount: 0, 
    totalMonthlyCount: 0, 
    totalQuarterlyCount: 0, 
    totalYearlyCount: 0 
  });
  const [missingSummaries, setMissingSummaries] = useState<any[]>([]);
  const [generationStates, setGenerationStates] = useState<Record<string, { progress: number, phase: number, status: string }>>({});

  const fetchQueueState = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const queue = await window.electron.ipcRenderer.invoke('summary:get-queue-state');
        if (queue && Array.isArray(queue)) {
           const map: Record<string, { progress: number, phase: number, status: string, error?: string }> = {};
           queue.forEach(q => { map[q.id] = { progress: q.progress, phase: q.phaseIdx, status: q.status, error: q.error }; });
           setGenerationStates(map);
        }
      } catch (e) { logger.warn('get-queue-state failed', e); }
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electron) {
      // 独立请求，避免单个失败阻塞全部
      try {
        const list = await window.electron.ipcRenderer.invoke('summary:list');
        setSummaries(list || []);
      } catch (e) {
        logger.warn('[SummaryData] summary:list failed:', e);
        setSummaries([]);
      }

      try {
        const st = await window.electron.ipcRenderer.invoke('summary:stats');
        logger.info('[RENDERER-DEBUG] summary:stats →', st);
        setStats({
          totalDiaryCount: st?.totalDiaryCount || 0,
          totalWeeklyCount: st?.weeklyCount || 0,
          totalMonthlyCount: st?.monthlyCount || 0,
          totalQuarterlyCount: st?.quarterlyCount || 0,
          totalYearlyCount: st?.yearlyCount || 0
        });
      } catch (e) {
        logger.warn('[SummaryData] summary:stats failed:', e);
      }

      try {
        const missing = await window.electron.ipcRenderer.invoke('summary:detect-missing', i18n.language);
        logger.info('[RENDERER-DEBUG] summary:detect-missing →', missing?.length, 'items');
        setMissingSummaries(missing || []);
      } catch (e) {
        logger.warn('[SummaryData] summary:detect-missing failed:', e);
        setMissingSummaries([]);
      }
    }
  }, [i18n.language]);

  useEffect(() => {
    fetchData();
    fetchQueueState();
  }, [fetchData, fetchQueueState]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
       const removeListener = window.electron.ipcRenderer.on('summary:queue-progress', (_event, queue) => {
           const map: Record<string, { progress: number, phase: number, status: string, error?: string }> = {};
           queue.forEach(q => { map[q.id] = { progress: q.progress, phase: q.phaseIdx, status: q.status, error: q.error }; });
           setGenerationStates(map);
           
           // If something completed, eagerly refresh data after a short delay
           if (queue.some(q => q.status === 'completed')) {
               setTimeout(fetchData, 1000);
           }
       });
       return () => removeListener();
    }
    return undefined;
  }, [fetchData]);

  const queueGeneration = async (items: any[]) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:queue-generation', items);
    }
  };

  const stopGeneration = async () => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:stop-generation');
    }
  };

  const generateSummary = async (type: string, dateRange: any) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.ipcRenderer.invoke('summary:generate', { type, dateRange });
    }
  };

  return { summaries, stats, missingSummaries, setMissingSummaries, generateSummary, queueGeneration, stopGeneration, generationStates, refreshData: fetchData };
}
