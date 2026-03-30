import { describe, it, expect, vi } from 'vitest';
import {
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt,
  getDefaultTemplate,
} from '../summary/summary-prompt-templates';
import {
  SummaryGeneratorService,
  type SummaryDiarySource,
  type SummarySource,
  type SummaryLLM,
} from '../summary/summary-generator.service';

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
  const mockDiarySource: SummaryDiarySource = {
    getDiariesInRange: vi.fn(async () => [
      {
        date: new Date('2026-03-24'),
        content: '今天完成了白守 Next 的核心引擎移植',
        tags: ['coding', 'baishou'],
      },
      {
        date: new Date('2026-03-25'),
        content: '完成了全部 15 个 Agent 工具的复刻',
        tags: ['coding'],
      },
    ]),
  };

  const mockSummarySource: SummarySource = {
    getSummaries: vi.fn(async () => []),
  };

  const mockLlm: SummaryLLM = {
    generateContent: vi.fn(async () => '# AI 生成的总结内容'),
  };

  it('should generate weekly summary', async () => {
    const service = new SummaryGeneratorService(
      mockDiarySource,
      mockSummarySource,
      mockLlm,
      () => 'gpt-4o',
    );

    const result = await service.generate({
      type: 'weekly',
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      weekNumber: 4,
    });

    expect(result).toBe('# AI 生成的总结内容');
    expect(mockLlm.generateContent).toHaveBeenCalled();
    const prompt = (mockLlm.generateContent as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as string;
    expect(prompt).toContain('核心引擎移植');
    expect(prompt).toContain('Agent 工具');
  });

  it('should throw when no data available', async () => {
    const emptyDiary: SummaryDiarySource = {
      getDiariesInRange: vi.fn(async () => []),
    };

    const service = new SummaryGeneratorService(
      emptyDiary,
      mockSummarySource,
      mockLlm,
      () => 'gpt-4o',
    );

    await expect(
      service.generate({
        type: 'weekly',
        startDate: new Date('2026-03-23'),
        endDate: new Date('2026-03-29'),
      }),
    ).rejects.toThrow('没有找到可用的数据');
  });

  it('should call onStatus callback', async () => {
    const service = new SummaryGeneratorService(
      mockDiarySource,
      mockSummarySource,
      mockLlm,
      () => 'claude-4',
    );

    const statuses: string[] = [];
    await service.generate(
      {
        type: 'weekly',
        startDate: new Date('2026-03-23'),
        endDate: new Date('2026-03-29'),
      },
      (s) => statuses.push(s),
    );

    expect(statuses).toContain('正在读取数据...');
    expect(statuses.some((s) => s.includes('claude-4'))).toBe(true);
  });
});
