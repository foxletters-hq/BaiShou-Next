import { describe, it, expect, vi } from 'vitest';

// Mock database deps to prevent native binding loading
vi.mock('better-sqlite3', () => ({ default: class {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }));

import { ContextBuilderService } from '../context-builder.service';
import { SummaryType } from '@baishou/shared';
import type { Summary, Diary } from '@baishou/shared';

describe('ContextBuilderService', () => {
  it('should filter out lower tier notes correctly if covered by higher tier summaries', () => {
    // 使用无时区后缀的日期（本地时间），避免 UTC→本地转换导致跨月问题
    const fakeDiaries: Diary[] = [
      { id: 1, date: new Date(2026, 2, 10), content: 'Lower tier text to be hidden.', createdAt: new Date(), updatedAt: new Date(), isFavorite: false, mediaPaths: [] },
      { id: 2, date: new Date(2026, 3, 10), content: 'This should be visible.', createdAt: new Date(), updatedAt: new Date(), isFavorite: false, mediaPaths: [] }
    ];

    const fakeSummaries: Summary[] = [
      {
        id: 101,
        type: SummaryType.monthly,
        startDate: new Date(2026, 2, 1),     // March 1
        endDate: new Date(2026, 2, 31, 23, 59, 59),  // March 31
        content: 'March Monthly Covered Summaries!'
      }
    ];

    const contextBuilder = new ContextBuilderService({} as any, {} as any);
    const startDate = new Date(2026, 0, 1);  // Jan 1

    const result = contextBuilder.processContextData(fakeSummaries, fakeDiaries, startDate);

    expect(result.monthCount).toBe(1);
    expect(result.diaryCount).toBe(1); // March diary hidden (covered by monthly), April diary visible

    expect(result.text).toContain('March Monthly Covered Summaries!');
    expect(result.text).not.toContain('Lower tier text to be hidden.');
    expect(result.text).toContain('This should be visible.');
  });
});
