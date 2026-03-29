import { describe, it, expect } from 'vitest';
import { SummarySchema } from '../types/summary.types';

describe('SummarySchema', () => {
  it('should validate correct summary', () => {
    const input = {
      type: 'weekly',
      startDate: new Date(),
      endDate: new Date(),
      content: 'Weekly review: good'
    };
    const result = SummarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should fail on invalid type', () => {
    const input = {
      type: 'invalid-type',
      startDate: new Date(),
      endDate: new Date(),
      content: 'something'
    };
    const result = SummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
