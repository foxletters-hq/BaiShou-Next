import { describe, it, expect } from 'vitest';
import { ContextBuilderService } from '../context-builder.service';
import { Summary, Diary, SummaryType } from '@baishou/shared';

describe('ContextBuilderService', () => {
  it('should filter out lower tier notes correctly if covered by higher tier summaries', async () => {
    // TDD for processContextData isolated processing behavior 
    
    const fakeDiaries: Diary[] = [
      { id: 1, date: new Date('2026-03-10T12:00:00Z'), content: 'Lower tier text to be hidden.', createdAt: new Date(), updatedAt: new Date(), isFavorite: false, mediaPaths: [] },
      { id: 2, date: new Date('2026-04-10T12:00:00Z'), content: 'This should be visible.', createdAt: new Date(), updatedAt: new Date(), isFavorite: false, mediaPaths: [] }
    ];

    const fakeSummaries: Summary[] = [
      {
        id: 101,
        type: SummaryType.monthly,
        startDate: new Date('2026-03-01T00:00:00Z'),
        endDate: new Date('2026-03-31T23:59:59Z'),
        content: 'March Monthly Covered Summaries!'
      }
    ];

    const contextBuilder = new ContextBuilderService({} as any, {} as any);
    const startDate = new Date('2026-01-01T00:00:00Z');

    const result = contextBuilder.processContextData(fakeSummaries, fakeDiaries, startDate);

    expect(result.monthCount).toBe(1);
    expect(result.diaryCount).toBe(1); // March diary is hidden since March Monthly is present!
    
    expect(result.text).toContain('Monthly Summary 2026-03-01');
    expect(result.text).toContain('March Monthly Covered Summaries!');
    expect(result.text).not.toContain('Lower tier text to be hidden.');
    expect(result.text).toContain('This should be visible.');
  });
});
