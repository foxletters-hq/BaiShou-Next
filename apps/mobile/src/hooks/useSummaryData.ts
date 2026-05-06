import { useState, useEffect, useCallback } from 'react';
import { useBaishou } from '../providers/BaishouProvider';

interface Summary {
  id: string;
  type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate: string;
  content: string;
  title?: string;
}

interface Stats {
  totalDiaryCount: number;
  totalWeeklyCount: number;
  totalMonthlyCount: number;
  totalQuarterlyCount: number;
  totalYearlyCount: number;
}

interface MissingSummary {
  type: string;
  startDate: string;
  endDate: string;
  label?: string;
  dateRangeStr?: string;
}

interface GenerationState {
  progress: number;
  phase: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export function useSummaryData() {
  const { services, dbReady } = useBaishou();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [stats, setStats] = useState<Stats>({ 
    totalDiaryCount: 0, 
    totalWeeklyCount: 0, 
    totalMonthlyCount: 0, 
    totalQuarterlyCount: 0, 
    totalYearlyCount: 0 
  });
  const [missingSummaries, setMissingSummaries] = useState<MissingSummary[]>([]);
  const [generationStates, setGenerationStates] = useState<Record<string, GenerationState>>({});
  const [loading, setLoading] = useState(true);

  // 计算周数
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - firstDayOfYear.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  };

  // 获取周一
  const getMonday = (date: Date): Date => {
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(date);
    monday.setDate(date.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // 获取周日
  const getSunday = (monday: Date): Date => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  // 检测缺失的总结
  const detectMissing = useCallback(async (diaryDates: Date[], existingSummaries: Summary[]): Promise<MissingSummary[]> => {
    if (diaryDates.length === 0) return [];

    const missing: MissingSummary[] = [];
    const now = new Date();
    
    // 按日期排序
    const sortedDates = [...diaryDates].sort((a, b) => a.getTime() - b.getTime());
    const firstDate = sortedDates[0]!;
    
    // 检测缺失的周总结
    const existingWeeks = new Set<string>();
    existingSummaries
      .filter(s => s.type === 'weekly')
      .forEach(s => {
        const start = new Date(s.startDate);
        const key = `${start.getFullYear()}-${getWeekNumber(start)}`;
        existingWeeks.add(key);
      });
    
    // 从第一篇日记的周开始，到当前周之前
    let currentMonday = getMonday(firstDate);
    while (currentMonday < now) {
      const currentSunday = getSunday(currentMonday);
      const weekKey = `${currentMonday.getFullYear()}-${getWeekNumber(currentMonday)}`;
      
      // 检查这一周是否有日记
      const hasDiaryInWeek = sortedDates.some(d => 
        d >= currentMonday && d <= currentSunday
      );
      
      if (hasDiaryInWeek && !existingWeeks.has(weekKey) && currentSunday < now) {
        missing.push({
          type: 'weekly',
          startDate: currentMonday.toISOString(),
          endDate: currentSunday.toISOString(),
          label: `${currentMonday.getFullYear()}年第${getWeekNumber(currentMonday)}周`,
          dateRangeStr: `${currentMonday.toLocaleDateString()} - ${currentSunday.toLocaleDateString()}`,
        });
      }
      
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }
    
    // 检测缺失的月总结
    const existingMonths = new Set<string>();
    existingSummaries
      .filter(s => s.type === 'monthly')
      .forEach(s => {
        const start = new Date(s.startDate);
        existingMonths.add(`${start.getFullYear()}-${start.getMonth()}`);
      });
    
    // 获取所有有日记的月份
    const diaryMonths = new Set<string>();
    sortedDates.forEach(d => {
      diaryMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    
    diaryMonths.forEach(monthKey => {
      if (!existingMonths.has(monthKey)) {
        const [yearStr, monthStr] = monthKey.split('-');
        const year = parseInt(yearStr!, 10);
        const month = parseInt(monthStr!, 10);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        
        // 只处理当前月之前的月份
        if (monthEnd < now) {
          missing.push({
            type: 'monthly',
            startDate: monthStart.toISOString(),
            endDate: monthEnd.toISOString(),
            label: `${year}年${month + 1}月`,
            dateRangeStr: `${monthStart.toLocaleDateString()} - ${monthEnd.toLocaleDateString()}`,
          });
        }
      }
    });
    
    // 检测缺失的季总结
    const existingQuarters = new Set<string>();
    existingSummaries
      .filter(s => s.type === 'quarterly')
      .forEach(s => {
        const start = new Date(s.startDate);
        const quarter = Math.ceil((start.getMonth() + 1) / 3);
        existingQuarters.add(`${start.getFullYear()}-Q${quarter}`);
      });
    
    const diaryQuarters = new Set<string>();
    sortedDates.forEach(d => {
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      diaryQuarters.add(`${d.getFullYear()}-Q${quarter}`);
    });
    
    diaryQuarters.forEach(quarterKey => {
      if (!existingQuarters.has(quarterKey)) {
        const [yearStr, qStr] = quarterKey.split('-Q');
        const year = parseInt(yearStr!, 10);
        const quarter = parseInt(qStr!, 10);
        const startMonth = (quarter - 1) * 3;
        const quarterStart = new Date(year, startMonth, 1);
        const quarterEnd = new Date(year, startMonth + 3, 0, 23, 59, 59);
        
        if (quarterEnd < now) {
          missing.push({
            type: 'quarterly',
            startDate: quarterStart.toISOString(),
            endDate: quarterEnd.toISOString(),
            label: `${year}年Q${quarter}`,
            dateRangeStr: `${quarterStart.toLocaleDateString()} - ${quarterEnd.toLocaleDateString()}`,
          });
        }
      }
    });
    
    // 检测缺失的年总结
    const existingYears = new Set<number>();
    existingSummaries
      .filter(s => s.type === 'yearly')
      .forEach(s => {
        existingYears.add(new Date(s.startDate).getFullYear());
      });
    
    const diaryYears = new Set<number>();
    sortedDates.forEach(d => {
      diaryYears.add(d.getFullYear());
    });
    
    diaryYears.forEach(year => {
      if (!existingYears.has(year)) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);
        
        if (yearEnd < now) {
          missing.push({
            type: 'yearly',
            startDate: yearStart.toISOString(),
            endDate: yearEnd.toISOString(),
            label: `${year}年度`,
            dateRangeStr: `${yearStart.toLocaleDateString()} - ${yearEnd.toLocaleDateString()}`,
          });
        }
      }
    });
    
    // 按开始日期排序
    missing.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    return missing;
  }, []);

  const fetchData = useCallback(async () => {
    if (!dbReady || !services) return;
    
    try {
      setLoading(true);
      
      // 获取总结列表
      const summaryList = await services.summaryManager.list();
      const mappedSummaries = summaryList.map(s => ({
        id: String(s.id),
        type: s.type,
        startDate: s.startDate instanceof Date ? s.startDate.toISOString() : s.startDate,
        endDate: s.endDate instanceof Date ? s.endDate.toISOString() : s.endDate,
        content: s.content,
        title: s.title,
      }));
      setSummaries(mappedSummaries);
      
      // 获取统计信息
      const diaryCount = await services.diaryService.count();
      const weeklyCount = summaryList.filter(s => s.type === 'weekly').length;
      const monthlyCount = summaryList.filter(s => s.type === 'monthly').length;
      const quarterlyCount = summaryList.filter(s => s.type === 'quarterly').length;
      const yearlyCount = summaryList.filter(s => s.type === 'yearly').length;
      
      setStats({
        totalDiaryCount: diaryCount,
        totalWeeklyCount: weeklyCount,
        totalMonthlyCount: monthlyCount,
        totalQuarterlyCount: quarterlyCount,
        totalYearlyCount: yearlyCount,
      });
      
      // 检测缺失的总结
      try {
        const allDiaries = await services.diaryService.listAll({ limit: 10000 });
        const diaryDates = allDiaries
          .map(d => d.date instanceof Date ? d.date : new Date(d.date))
          .filter(d => !isNaN(d.getTime()));
        
        const missing = await detectMissing(diaryDates, mappedSummaries);
        setMissingSummaries(missing);
      } catch (e) {
        console.warn('Detect missing summaries failed:', e);
        setMissingSummaries([]);
      }
      
    } catch (e) {
      console.warn('Failed to fetch summary data', e);
    } finally {
      setLoading(false);
    }
  }, [dbReady, services, detectMissing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const queueGeneration = async (items: MissingSummary[]) => {
    if (!dbReady || !services) return;
    
    // 这里需要实现批量生成逻辑
    // 由于mobile应用中没有实现summary:queue-generation IPC，暂时留空
    console.log('Queue generation for items:', items);
  };

  const generateSummary = async (type: string, dateRange: { startDate: string; endDate: string }) => {
    if (!dbReady || !services) return;
    
    // 这里需要实现单个生成逻辑
    // 由于mobile应用中没有实现summary:generate IPC，暂时留空
    console.log('Generate summary for:', type, dateRange);
  };

  const refreshData = () => {
    fetchData();
  };

  return { 
    summaries, 
    stats, 
    missingSummaries, 
    setMissingSummaries, 
    generateSummary, 
    queueGeneration, 
    generationStates, 
    refreshData,
    loading
  };
}
