import { describe, it, expect } from 'vitest';
import { DiarySchema } from '../types/diary.types';

describe('DiarySchema', () => {
  it('should pass with valid input', () => {
    const input = {
      date: new Date(),
      content: 'Hello world',
      tags: 'test,diary'
    };
    const result = DiarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should fail with missing content', () => {
    const input = {
      date: new Date(),
      tags: 'test'
    };
    const result = DiarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should fail with empty content', () => {
    const input = {
      date: new Date(),
      content: '', // min(1)
    };
    const result = DiarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
