import { describe, it, expect } from 'vitest';
import { MissingSummaryDetector } from '../missing-summary-detector.service';
import { Diary, Summary, SummaryType } from '@baishou/shared';

describe('MissingSummaryDetector', () => {
  it('should detect missing weekly summary when there is a diary but no summary', () => {
    // Inject custom test case logic simulating isolated data array
    const fakeDiary: Diary = {
      id: 1,
      date: new Date('2026-03-24T12:00:00Z'), // Tuesday
      content: 'test content',
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      mediaPaths: []
    };

    const detector = new MissingSummaryDetector({} as any, {} as any);
    // Uses private method via loose casting for inner math testing wrapper
    const missing = (detector as any).detectMissing([fakeDiary], [], 'zh');

    expect(missing).toHaveLength(1);
    expect(missing[0].type).toBe(SummaryType.weekly);
    // the Monday for 2026-03-24 is 2026-03-23 local time
    expect(missing[0].startDate.getDate()).toBeLessThanOrEqual(24);
  });

  it('should detect missing monthly summary if weekly summary exists but monthly does not', () => {
    // Generate a weekly summary for a past month (Feb 2026) -> end date should definitely be past today
    const fakeWeekly: Summary = {
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
    expect(missing[0].label).toBe('2/2026'); // english translation check string
  });
});
