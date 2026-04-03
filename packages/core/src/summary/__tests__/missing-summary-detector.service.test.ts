import { describe, it, expect, vi } from 'vitest';

// Mock 掉 native 依赖（vi.mock 会被 vitest 自动提升到文件顶部）
vi.mock('better-sqlite3', () => ({ default: class {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }));

describe('MissingSummaryDetector', () => {
  it('should detect missing weekly summary when there is a diary but no summary', async () => {
    const { SummaryType } = await import('@baishou/shared');
    const { MissingSummaryDetector } = await import('../missing-summary-detector.service');

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
  });

  it('should detect missing monthly summary if weekly summary exists but monthly does not', async () => {
    const { SummaryType } = await import('@baishou/shared');
    const { MissingSummaryDetector } = await import('../missing-summary-detector.service');

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
  });
});
