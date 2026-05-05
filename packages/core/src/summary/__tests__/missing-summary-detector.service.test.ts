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

  it('should detect missing monthly summary when diaries exist in month but no weeklies', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    const diaries = [
      makeDiary('2026-03-03T12:00:00Z'),
      makeDiary('2026-03-10T12:00:00Z'),
      makeDiary('2026-03-24T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const monthlies = missing.filter((m: any) => m.type === SummaryType.monthly);
    expect(monthlies.length).toBe(1);
    expect(monthlies[0].label).toBe('2026年3月');

    vi.useRealTimers();
  });

  it('should detect missing quarterly summary when diaries exist in quarter but no monthlies', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'));

    const diaries = [
      makeDiary('2026-01-15T12:00:00Z'),
      makeDiary('2026-02-20T12:00:00Z'),
      makeDiary('2026-03-10T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const quarterlies = missing.filter((m: any) => m.type === SummaryType.quarterly);
    expect(quarterlies.length).toBe(1);
    expect(quarterlies[0].label).toBe('2026年Q1');

    vi.useRealTimers();
  });

  it('should detect missing yearly summary when diaries exist in year but no quarterlies', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T12:00:00Z'));

    const diaries = [
      makeDiary('2026-01-15T12:00:00Z'),
      makeDiary('2026-04-10T12:00:00Z'),
      makeDiary('2026-07-20T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const yearlies = missing.filter((m: any) => m.type === SummaryType.yearly);
    expect(yearlies.length).toBe(1);
    expect(yearlies[0].label).toBe('2026年度');

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

  it('should not suggest monthly for a month that has no diaries and no weeklies', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    const diaries = [
      makeDiary('2026-01-15T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const monthlies = missing.filter((m: any) => m.type === SummaryType.monthly);
    expect(monthlies).toHaveLength(1);
    expect(monthlies[0].label).toBe('2026年1月');

    vi.useRealTimers();
  });

  it('should return all tiers at once when diaries span a full year with no summaries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T12:00:00Z'));

    const diaries = [
      makeDiary('2026-01-15T12:00:00Z'),
      makeDiary('2026-02-20T12:00:00Z'),
      makeDiary('2026-03-10T12:00:00Z'),
      makeDiary('2026-06-01T12:00:00Z'),
      makeDiary('2026-09-15T12:00:00Z'),
      makeDiary('2026-12-20T12:00:00Z'),
    ];

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing(diaries, [], 'zh');

    const types = missing.map((m: any) => m.type);
    expect(types).toContain(SummaryType.weekly);
    expect(types).toContain(SummaryType.monthly);
    expect(types).toContain(SummaryType.quarterly);
    expect(types).toContain(SummaryType.yearly);

    vi.useRealTimers();
  });
});
