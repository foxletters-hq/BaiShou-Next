import { Diary, Summary, SummaryType, MissingSummary } from '@baishou/shared';
import type { DiaryRepository } from '@baishou/database/src/repositories/diary.repository';
import type { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';

export class MissingSummaryDetector {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository
  ) {}

  async getAllMissing(locale: string = 'zh'): Promise<MissingSummary[]> {
    const allDiaries = await this.diaryRepo.list(); // assuming list() returns all when no options passed
    const allSummaries = await this.summaryRepo.getSummaries();

    if (allDiaries.length === 0) return [];

    return this.detectMissing(allDiaries, allSummaries, locale);
  }

  private detectMissing(diaries: Diary[], summaries: Summary[], locale: string): MissingSummary[] {
    const summaryMap: Record<string, Summary[]> = {
      [SummaryType.weekly]: [],
      [SummaryType.monthly]: [],
      [SummaryType.quarterly]: [],
      [SummaryType.yearly]: [],
    };

    for (const s of summaries) {
      (summaryMap[s.type] ??= []).push(s);
    }

    const weekly = this.getMissingWeekly(diaries, summaryMap[SummaryType.weekly] ?? [], locale);
    const monthly = this.getMissingMonthly(diaries, summaryMap[SummaryType.weekly] ?? [], summaryMap[SummaryType.monthly] ?? [], locale);
    const quarterly = this.getMissingQuarterly(diaries, summaryMap[SummaryType.monthly] ?? [], summaryMap[SummaryType.quarterly] ?? [], locale);
    const yearly = this.getMissingYearly(diaries, summaryMap[SummaryType.quarterly] ?? [], summaryMap[SummaryType.yearly] ?? [], locale);

    const result = [...weekly, ...monthly, ...quarterly, ...yearly];
    result.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return result;
  }

  private getMissingWeekly(diaries: Diary[], existingSummaries: Summary[], locale: string): MissingSummary[] {
    if (diaries.length === 0) return [];
    const missing: MissingSummary[] = [];
    const dates = diaries.map(d => d.date.getTime()).sort((a, b) => a - b);
    const firstDate = new Date(dates[0]!);
    const now = new Date();

    // 调整到周一 (JS Date.getDay(): 0 is Sunday, 1 is Monday)
    let dayOfWeek = firstDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    let currentStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() - diff);

    while (true) {
      const currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() + 6, 23, 59, 59);

      if (currentEnd.getTime() > now.getTime()) break;

      const hasEntry = dates.some(timestamp => timestamp >= currentStart.getTime() && timestamp <= currentEnd.getTime());

      if (hasEntry) {
        const hasSummary = existingSummaries.some(s => 
          s.startDate.getFullYear() === currentStart.getFullYear() &&
          s.startDate.getMonth() === currentStart.getMonth() &&
          s.startDate.getDate() === currentStart.getDate()
        );

        if (!hasSummary) {
          const weekNum = this.getWeekNumber(currentStart);
          missing.push({
            type: SummaryType.weekly,
            startDate: new Date(currentStart),
            endDate: new Date(currentEnd),
            label: this.formatLabel(SummaryType.weekly, currentStart, locale, { week: weekNum }),
            weekNumber: weekNum,
          });
        }
      }

      currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() + 7);
      if (currentStart.getFullYear() > now.getFullYear() + 1) break; // safenet
    }
    return missing;
  }

  private getMissingMonthly(diaries: Diary[], weeklies: Summary[], monthlies: Summary[], locale: string): MissingSummary[] {
    const missing: MissingSummary[] = [];
    const now = new Date();

    const monthsSet = new Set<string>();
    for (const w of weeklies) {
      monthsSet.add(`${w.startDate.getFullYear()}-${w.startDate.getMonth()}`);
    }
    for (const d of diaries) {
      monthsSet.add(`${d.date.getFullYear()}-${d.date.getMonth()}`);
    }

    if (monthsSet.size === 0) return [];

    for (const key of monthsSet) {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr!, 10);
      const month = parseInt(monthStr!, 10);

      const mStart = new Date(year, month, 1);
      const mEnd = new Date(year, month + 1, 0, 23, 59, 59); // 最后一天最后时刻

      if (mEnd.getTime() > now.getTime()) continue;

      const hasMonthly = monthlies.some(s => s.startDate.getFullYear() === year && s.startDate.getMonth() === month);

      if (!hasMonthly) {
        missing.push({
          type: SummaryType.monthly,
          startDate: mStart,
          endDate: mEnd,
          label: this.formatLabel(SummaryType.monthly, mStart, locale),
        });
      }
    }
    return missing;
  }

  private getMissingQuarterly(diaries: Diary[], monthlies: Summary[], quarterlies: Summary[], locale: string): MissingSummary[] {
    const missing: MissingSummary[] = [];
    const now = new Date();

    const quartersSet = new Set<string>();
    for (const m of monthlies) {
      const q = Math.ceil((m.startDate.getMonth() + 1) / 3);
      quartersSet.add(`${m.startDate.getFullYear()}-${q}`);
    }
    for (const d of diaries) {
      const q = Math.ceil((d.date.getMonth() + 1) / 3);
      quartersSet.add(`${d.date.getFullYear()}-${q}`);
    }

    if (quartersSet.size === 0) return [];

    for (const qKey of quartersSet) {
      const [yearStr, qStr] = qKey.split('-');
      const year = parseInt(yearStr!, 10);
      const quarter = parseInt(qStr!, 10);

      const startMonth = (quarter - 1) * 3;
      const qStart = new Date(year, startMonth, 1);
      const qEnd = new Date(year, startMonth + 3, 0, 23, 59, 59);

      if (qEnd.getTime() > now.getTime()) continue;

      const hasQuarterly = quarterlies.some(s => 
        s.type === SummaryType.quarterly &&
        s.startDate.getFullYear() === year &&
        Math.ceil((s.startDate.getMonth() + 1) / 3) === quarter
      );

      if (!hasQuarterly) {
        missing.push({
          type: SummaryType.quarterly,
          startDate: qStart,
          endDate: qEnd,
          label: this.formatLabel(SummaryType.quarterly, qStart, locale, { quarter }),
        });
      }
    }
    return missing;
  }

  private getMissingYearly(diaries: Diary[], quarterlies: Summary[], yearlies: Summary[], locale: string): MissingSummary[] {
    const missing: MissingSummary[] = [];
    const now = new Date();

    const yearsSet = new Set<number>();
    for (const q of quarterlies) {
      yearsSet.add(q.startDate.getFullYear());
    }
    for (const d of diaries) {
      yearsSet.add(d.date.getFullYear());
    }

    if (yearsSet.size === 0) return [];

    for (const year of yearsSet) {
      const yStart = new Date(year, 0, 1);
      const yEnd = new Date(year, 11, 31, 23, 59, 59);

      if (yEnd.getTime() > now.getTime()) continue;

      const hasYearly = yearlies.some(s => s.type === SummaryType.yearly && s.startDate.getFullYear() === year);

      if (!hasYearly) {
        missing.push({
          type: SummaryType.yearly,
          startDate: yStart,
          endDate: yEnd,
          label: this.formatLabel(SummaryType.yearly, yStart, locale),
        });
      }
    }
    return missing;
  }

  private getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.floor((days - date.getDay() + 10) / 7);
  }

  private formatLabel(type: SummaryType, date: Date, locale: string, options?: { week?: number; quarter?: number }): string {
    const isEn = locale.startsWith('en');
    const isJa = locale.startsWith('ja');

    if (isEn) {
      if (type === SummaryType.weekly) return `Week ${options?.week}, ${date.getFullYear()}`;
      if (type === SummaryType.monthly) return `${date.getMonth() + 1}/${date.getFullYear()}`;
      if (type === SummaryType.quarterly) return `${date.getFullYear()} Q${options?.quarter}`;
      if (type === SummaryType.yearly) return `Year ${date.getFullYear()}`;
    } else if (isJa) {
      if (type === SummaryType.weekly) return `${date.getFullYear()}年 第${options?.week}週`;
      if (type === SummaryType.monthly) return `${date.getFullYear()}年${date.getMonth() + 1}月`;
      if (type === SummaryType.quarterly) return `${date.getFullYear()}年 Q${options?.quarter}`;
      if (type === SummaryType.yearly) return `${date.getFullYear()}年度`;
    } 

    if (type === SummaryType.weekly) return `${date.getFullYear()}年第${options?.week}周`;
    if (type === SummaryType.monthly) return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    if (type === SummaryType.quarterly) return `${date.getFullYear()}年Q${options?.quarter}`;
    if (type === SummaryType.yearly) return `${date.getFullYear()}年度`;
    return '';
  }
}
