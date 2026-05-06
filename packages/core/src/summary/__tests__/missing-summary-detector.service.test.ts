import { describe, it, expect, vi } from 'vitest';
import { SummaryType } from '@baishou/shared';
import { MissingSummaryDetector } from '../missing-summary-detector.service';

vi.mock('better-sqlite3', () => ({ default: class {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }));

function makeDiary(dateStr: string, id = 1) {
  return {
    id,
    date: new Date(dateStr),
    content: 'test content',
    createdAt: new Date(),
    updatedAt: new Date(),
    isFavorite: false,
    mediaPaths: [],
  };
}

function makeSummary(type: SummaryType, startDateStr: string, endDateStr: string, id = 1) {
  return {
    id,
    type,
    startDate: new Date(startDateStr),
    endDate: new Date(endDateStr),
    content: 'test summary content',
  };
}

describe('MissingSummaryDetector', () => {
  it('should detect missing weekly summary when there is a diary but no summary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    const fakeDiary = makeDiary('2026-03-24T12:00:00Z');

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing([fakeDiary], [], 'zh');

    expect(missing).toHaveLength(1);
    expect(missing[0].type).toBe(SummaryType.weekly);
    expect(missing[0].startDate.getDate()).toBeLessThanOrEqual(24);

    vi.useRealTimers();
  });

  it('should detect missing monthly summary if weekly summary exists but monthly does not', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T12:00:00Z'));

    const fakeWeekly = makeSummary(SummaryType.weekly, '2026-02-02T00:00:00Z', '2026-02-08T23:59:59Z');

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing([], [fakeWeekly], 'en');

    expect(missing).toHaveLength(1);
    expect(missing[0].type).toBe(SummaryType.monthly);
    expect(missing[0].label).toBe('2/2026');
    vi.useRealTimers();
  });

  it('should only suggest one weekly for a single diary (no empty weeks)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    // 只有一篇日记，应只检测到一个缺失的周记
    const fakeDiary = makeDiary('2026-03-24T12:00:00Z');
    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing([fakeDiary], [], 'zh');

    const weeklies = missing.filter((m: any) => m.type === SummaryType.weekly);
    expect(weeklies).toHaveLength(1);

    vi.useRealTimers();
  });

  it('should detect exact number of weeklies matching diary weeks, skipping empty weeks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    // 第10周 (3.2-3.8): 有日记
    // 第11周 (3.9-3.15): 空 —— 不应被建议
    // 第12周 (3.16-3.22): 有日记
    // 第13周 (3.23-3.29): 有日记
    // 第14周 (3.30-4.5): 空 —— 不应被建议
    const diaries = [
      makeDiary('2026-03-03T12:00:00Z'),  // 第10周
      makeDiary('2026-03-17T12:00:00Z'),  // 第12周
      makeDiary('2026-03-24T12:00:00Z'),  // 第13周
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const weeklies = missing.filter((m: any) => m.type === SummaryType.weekly);
    // 3 个周有日记 + 0 个周空 → 应只有 3 个建议
    expect(weeklies.length).toBe(3);

    // 验证建议的周每次都包含对应日记的日期
    for (const w of weeklies) {
      const hasDiaryInWeek = diaries.some(
        (d: any) => d.date.getTime() >= w.startDate.getTime() && d.date.getTime() <= w.endDate.getTime()
      );
      expect(hasDiaryInWeek).toBe(true);
    }

    vi.useRealTimers();
  });

  it('should not suggest monthly when no weeklies exist (cascade)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));

    const diaries = [
      makeDiary('2026-03-03T12:00:00Z'),
      makeDiary('2026-03-10T12:00:00Z'),
      makeDiary('2026-03-24T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    // 级联：有日记但无已有周记 → 只建议周记，不建议月报
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const weeklies = missing.filter((m: any) => m.type === SummaryType.weekly);
    const monthlies = missing.filter((m: any) => m.type === SummaryType.monthly);

    expect(weeklies.length).toBeGreaterThan(0);
    expect(monthlies).toHaveLength(0);

    vi.useRealTimers();
  });
});
