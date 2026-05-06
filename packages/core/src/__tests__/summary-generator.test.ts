import { describe, it, expect, vi } from 'vitest';
import {
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt,
  getDefaultTemplate,
} from '../summary/summary-prompt-templates';
import { SummaryType } from '@baishou/shared';

// Mock database deps
vi.mock('better-sqlite3', () => ({ default: class {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }));

describe('SummaryPromptTemplates', () => {
  it('should replace placeholders in weekly prompt', () => {
    const result = buildWeeklyPrompt({
      year: 2026,
      month: 3,
      week: 4,
      start: '2026-03-23',
      end: '2026-03-29',
    });

    expect(result).toContain('2026');
    expect(result).toContain('3月');
    expect(result).toContain('第4周');
    expect(result).toContain('2026-03-23');
    expect(result).toContain('2026-03-29');
  });

  it('should replace placeholders in monthly prompt', () => {
    const result = buildMonthlyPrompt({
      year: 2026,
      month: 1,
      start: '2026-01-01',
      end: '2026-01-31',
    });

    expect(result).toContain('2026');
    expect(result).toContain('1月');
  });

  it('should replace placeholders in quarterly prompt', () => {
    const result = buildQuarterlyPrompt({
      year: 2026,
      quarter: 1,
      start: '2026-01-01',
      end: '2026-03-31',
    });

    expect(result).toContain('第1季度');
  });

  it('should replace placeholders in yearly prompt', () => {
    const result = buildYearlyPrompt({
      year: 2026,
      start: '2026-01-01',
      end: '2026-12-31',
    });

    expect(result).toContain('2026 年度回顾');
  });

  it('should use custom template when provided', () => {
    const custom = '自定义模板: {year}年{month}月';
    const result = buildWeeklyPrompt({
      year: 2026,
      month: 6,
      week: 1,
      start: '2026-06-01',
      end: '2026-06-07',
      customTemplate: custom,
    });

    expect(result).toBe('自定义模板: 2026年6月');
  });

  it('getDefaultTemplate should return templates for all types', () => {
    expect(getDefaultTemplate('weekly')).toContain('周总结');
    expect(getDefaultTemplate('monthly')).toContain('月度总结');
    expect(getDefaultTemplate('quarterly')).toContain('季度总结');
    expect(getDefaultTemplate('yearly')).toContain('年度回顾');
  });
});

describe('SummaryGeneratorService', () => {
  it('should generate weekly summary via AsyncGenerator', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service');

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        {
          date: new Date('2026-03-24'),
          content: '今天完成了白守 Next 的核心引擎移植',
          tags: 'coding,baishou',
        },
      ]),
    };

    const mockSummaryRepo = {
      getSummaries: vi.fn(async () => []),
    };

    const mockAiClient = {
      generateContent: vi.fn(async () => '# AI 生成的总结内容'),
    };

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any,
    );

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4',
    };

    const outputs: string[] = [];
    for await (const chunk of service.generate(target)) {
      outputs.push(chunk);
    }

    // 应该至少有 STATUS: 消息和最终内容
    expect(outputs.some(o => o.startsWith('STATUS:'))).toBe(true);
    expect(outputs.some(o => o.includes('AI 生成的总结内容'))).toBe(true);
    expect(mockAiClient.generateContent).toHaveBeenCalled();
  });

  it('should yield no_data status when no diaries in range', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service');

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => []),
    };
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) };
    const mockAiClient = { generateContent: vi.fn(async () => '') };

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any,
    );

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4',
    };

    const outputs: string[] = [];
    for await (const chunk of service.generate(target)) {
      outputs.push(chunk);
    }

    expect(outputs).toContain('STATUS:no_data_error');
    // LLM 不应被调用
    expect(mockAiClient.generateContent).not.toHaveBeenCalled();
  });

  it('should include model name in status', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service');

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-03-24'), content: '一些内容', tags: '' },
      ]),
    };
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) };
    const mockAiClient = { generateContent: vi.fn(async () => '结果') };

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any,
    );

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4',
    };

    const outputs: string[] = [];
    for await (const chunk of service.generate(target, 'claude-4')) {
      outputs.push(chunk);
    }

    expect(outputs.some(s => s.includes('claude-4'))).toBe(true);
  });
});
