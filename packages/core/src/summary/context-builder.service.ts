import { Diary, Summary, SummaryType, ContextResult } from '@baishou/shared';
import { DiaryRepository } from '@baishou/database/src/repositories/diary.repository';
import { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';

export class ContextBuilderService {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository
  ) {}

  async buildLifeBookContext(months: number = 12): Promise<ContextResult> {
    const now = new Date();
    // 过去 months 个月的第一天
    let startMonth = now.getMonth() - months;
    let startYear = now.getFullYear();
    while (startMonth < 0) {
      startMonth += 12;
      startYear--;
    }
    const startDate = new Date(startYear, startMonth, 1);

    const allSummaries = await this.summaryRepo.getSummaries();
    const allDiaries = await this.diaryRepo.findByDateRange(startDate, now);

    return this.processContextData(allSummaries, allDiaries, startDate);
  }

  processContextData(allSummaries: Summary[], allDiaries: Diary[], startDate: Date): ContextResult {
    const relevantSummaries = allSummaries.filter(s => s.endDate.getTime() > startDate.getTime());

    const yList = relevantSummaries.filter(s => s.type === SummaryType.yearly);
    const qList = relevantSummaries.filter(s => s.type === SummaryType.quarterly);
    const mList = relevantSummaries.filter(s => s.type === SummaryType.monthly);
    const wList = relevantSummaries.filter(s => s.type === SummaryType.weekly);

    const coveredMonthKeys = new Set<string>();

    const formatMonthKey = (date: Date): string => {
      return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const markMonthsCovered = (s: Summary) => {
      let current = new Date(s.startDate.getFullYear(), s.startDate.getMonth(), 1);
      const endMonthDate = new Date(s.endDate.getFullYear(), s.endDate.getMonth(), 1);

      while (current.getTime() <= endMonthDate.getTime()) {
        coveredMonthKeys.add(formatMonthKey(current));
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    };

    for (const q of qList) markMonthsCovered(q);

    const visibleMonths = mList.filter(m => !coveredMonthKeys.has(formatMonthKey(m.startDate)));
    
    for (const m of visibleMonths) markMonthsCovered(m);

    const visibleWeeks = wList.filter(w => !coveredMonthKeys.has(formatMonthKey(w.endDate)));

    let cutoffDate: Date | null = null;
    if (visibleWeeks.length > 0) {
      cutoffDate = visibleWeeks[0].endDate;
      for (const w of visibleWeeks) {
        if (w.endDate.getTime() > cutoffDate.getTime()) {
          cutoffDate = w.endDate;
        }
      }
    }

    const visibleDiaries = allDiaries.filter(d => {
      const key = formatMonthKey(d.date);
      if (coveredMonthKeys.has(key)) return false;
      if (cutoffDate && d.date.getTime() <= cutoffDate.getTime()) return false;
      return true;
    });

    const buffer: string[] = [];
    const allItems: { date: Date; data: Summary | Diary; prefix: string }[] = [];

    // Prefix strings translation equivalents can be supplied here, but for now we default to english bounds or similar mapped keys.
    for (const i of yList) allItems.push({ date: i.startDate, data: i, prefix: 'Yearly Summary' });
    for (const i of qList) allItems.push({ date: i.startDate, data: i, prefix: 'Quarterly Summary' });
    for (const i of visibleMonths) allItems.push({ date: i.startDate, data: i, prefix: 'Monthly Summary' });
    for (const i of visibleWeeks) allItems.push({ date: i.startDate, data: i, prefix: 'Weekly Summary' });
    for (const d of visibleDiaries) allItems.push({ date: d.date, data: d, prefix: 'Diary' });

    allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    for (const item of allItems) {
      buffer.push(`## ${item.prefix} ${formatDateStr(item.date)}`);
      buffer.push(item.data.content);
      buffer.push('');
      buffer.push('---');
      buffer.push('');
    }

    return {
      text: buffer.join('\n'),
      yearCount: yList.length,
      quarterCount: qList.length,
      monthCount: visibleMonths.length,
      weekCount: visibleWeeks.length,
      diaryCount: visibleDiaries.length,
    };
  }
}
