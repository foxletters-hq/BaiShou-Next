import { describe, it, expect, vi } from 'vitest';
import { SummaryType } from '@baishou/shared';
import { MissingSummaryDetector } from '../missing-summary-detector.service';

vi.mock('better-sqlite3', () => ({ default: class {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }));

describe('MissingSummaryDetector', () => {
  it('should detect missing weekly summary when there is a diary but no summary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));

    const fakeDiary = {
      id: 1,
      date: new Date('2026-03-24T12:00:00Z'),
      content: 'test content',
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      mediaPaths: []
    };

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

    const fakeWeekly = {
      id: 1,
      type: SummaryType.weekly,
      startDate: new Date('2026-02-02T00:00:00Z'),
      endDate: new Date('2026-02-08T23:59:59Z'),
      content: 'weekly test'
    };

    const detector = new MissingSummaryDetector({} as any, {} as any);
    const missing = (detector as any).detectMissing([], [fakeWeekly], 'en');

    expect(missing).toHaveLength(1);
    expect(missing[0].type).toBe(SummaryType.monthly);
    expect(missing[0].label).toBe('2/2026');
    vi.useRealTimers();
  });
});
