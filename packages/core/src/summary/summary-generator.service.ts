/**
 * 总结生成服务
 *
 * 负责协调日记/总结仓库数据，并根据选定的 AI 供应商生成多维度的总结。
 * 支持 weekly / monthly / quarterly / yearly 四种总结类型。
 *
 * 原始实现：lib/features/summary/domain/services/summary_generator_service.dart (430 行)
 */

import {
  type SummaryType,
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt,
} from './summary-prompt-templates';

// ─── 依赖接口（DIP） ──────────────────────────────────────

export interface SummaryDiarySource {
  getDiariesInRange(
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      date: Date;
      content: string;
      tags: string[];
    }>
  >;
}

export interface SummaryEntry {
  type: SummaryType;
  startDate: Date;
  endDate: Date;
  content: string;
}

export interface SummarySource {
  getSummaries(start: Date): Promise<SummaryEntry[]>;
}

export interface SummaryLLM {
  generateContent(prompt: string, modelId: string): Promise<string>;
}

export interface MissingSummary {
  type: SummaryType;
  startDate: Date;
  endDate: Date;
  weekNumber?: number;
}

// ─── 服务实现 ──────────────────────────────────────────────

export class SummaryGeneratorService {
  constructor(
    private readonly diarySource: SummaryDiarySource,
    private readonly summarySource: SummarySource,
    private readonly llm: SummaryLLM,
    private readonly getModelId: () => string,
    private readonly getCustomTemplate?: (type: string) => string | undefined,
  ) {}

  /**
   * 生成指定类型的总结
   *
   * @param target 缺失的总结目标
   * @param onStatus 状态回调
   * @returns 生成的 Markdown 内容
   */
  async generate(
    target: MissingSummary,
    onStatus?: (status: string) => void,
  ): Promise<string> {
    onStatus?.('正在读取数据...');

    const modelId = this.getModelId();
    let contextData = '';
    let prompt = '';

    const customTemplate = this.getCustomTemplate?.(target.type);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    switch (target.type) {
      case 'weekly':
        contextData = await this.buildWeeklyContext(target.startDate, target.endDate);
        prompt = buildWeeklyPrompt({
          year: target.startDate.getFullYear(),
          month: target.startDate.getMonth() + 1,
          week: target.weekNumber ?? 1,
          start: fmt(target.startDate),
          end: fmt(target.endDate),
          customTemplate,
        });
        break;

      case 'monthly':
        contextData = await this.buildMonthlyContext(target.startDate, target.endDate);
        prompt = buildMonthlyPrompt({
          year: target.startDate.getFullYear(),
          month: target.startDate.getMonth() + 1,
          start: fmt(target.startDate),
          end: fmt(target.endDate),
          customTemplate,
        });
        break;

      case 'quarterly':
        contextData = await this.buildQuarterlyContext(target.startDate, target.endDate);
        prompt = buildQuarterlyPrompt({
          year: target.startDate.getFullYear(),
          quarter: Math.ceil((target.startDate.getMonth() + 1) / 3),
          start: fmt(target.startDate),
          end: fmt(target.endDate),
          customTemplate,
        });
        break;

      case 'yearly':
        contextData = await this.buildYearlyContext(target.startDate, target.endDate);
        prompt = buildYearlyPrompt({
          year: target.startDate.getFullYear(),
          start: fmt(target.startDate),
          end: fmt(target.endDate),
          customTemplate,
        });
        break;
    }

    if (!contextData) {
      throw new Error('没有找到可用的数据来生成总结');
    }

    onStatus?.(`AI 正在思考 (${modelId})...`);

    const combinedPrompt = `${prompt}\n\n${contextData}`;
    return this.llm.generateContent(combinedPrompt, modelId);
  }

  // ─── 上下文构建 ──────────────────────────────────────────

  private async buildWeeklyContext(start: Date, end: Date): Promise<string> {
    const diaries = await this.diarySource.getDiariesInRange(start, end);
    if (diaries.length === 0) return '';

    const lines: string[] = [
      `## 原始日记数据 (${this.fmt(start)} ~ ${this.fmt(end)})`,
    ];
    for (const d of diaries) {
      lines.push(`\n#### ${this.fmt(d.date)}`);
      lines.push(d.content);
      if (d.tags.length > 0) {
        lines.push(`标签: ${d.tags.join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  private async buildMonthlyContext(start: Date, end: Date): Promise<string> {
    const [diaries, summaries] = await Promise.all([
      this.diarySource.getDiariesInRange(start, end),
      this.summarySource.getSummaries(start),
    ]);

    const weeklies = summaries.filter(
      (s) => s.type === 'weekly' && s.startDate >= start && s.startDate <= end,
    );

    if (diaries.length === 0 && weeklies.length === 0) return '';

    const lines: string[] = [];

    if (diaries.length > 0) {
      lines.push(
        `## ${start.getFullYear()}年${start.getMonth() + 1}月 原始日记数据`,
      );
      for (const d of diaries) {
        lines.push(`\n#### ${this.fmt(d.date)}`);
        lines.push(d.content);
        if (d.tags.length > 0) lines.push(`标签: ${d.tags.join(', ')}`);
      }
    }

    if (weeklies.length > 0) {
      lines.push('\n## 本月周记');
      for (const s of weeklies) {
        lines.push(`\n#### ${this.fmt(s.startDate)} ~ ${this.fmt(s.endDate)} 周记`);
        lines.push(s.content);
      }
    }

    return lines.join('\n');
  }

  private async buildQuarterlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summarySource.getSummaries(start);

    const weeklies = summaries
      .filter((s) => s.type === 'weekly' && s.startDate >= start && s.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const monthlies = summaries
      .filter((s) => s.type === 'monthly' && s.startDate >= start && s.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (weeklies.length === 0 && monthlies.length === 0) return '';

    const q = Math.ceil((start.getMonth() + 1) / 3);
    const lines: string[] = [
      `## ${start.getFullYear()}年Q${q} 数据汇总`,
    ];

    if (weeklies.length > 0) {
      lines.push('\n### 周记');
      for (const s of weeklies) {
        lines.push(`\n#### ${this.fmt(s.startDate)} ~ ${this.fmt(s.endDate)} 周记`);
        lines.push(s.content);
      }
    }

    if (monthlies.length > 0) {
      lines.push('\n### 月报');
      for (const s of monthlies) {
        lines.push(`\n#### ${s.startDate.getFullYear()}-${s.startDate.getMonth() + 1} 月报`);
        lines.push(s.content);
      }
    }

    return lines.join('\n');
  }

  private async buildYearlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summarySource.getSummaries(start);

    const weeklies = summaries
      .filter((s) => s.type === 'weekly' && s.startDate >= start && s.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const monthlies = summaries
      .filter((s) => s.type === 'monthly' && s.startDate >= start && s.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const quarterlies = summaries
      .filter((s) => s.type === 'quarterly' && s.startDate >= start && s.startDate <= end)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    if (weeklies.length === 0 && monthlies.length === 0 && quarterlies.length === 0)
      return '';

    const lines: string[] = [
      `## ${start.getFullYear()}年 年度数据汇总`,
    ];

    if (weeklies.length > 0) {
      lines.push('\n### 周记汇总');
      for (const s of weeklies) {
        lines.push(`\n#### ${this.fmt(s.startDate)} ~ ${this.fmt(s.endDate)} 周记`);
        lines.push(s.content);
      }
    }

    if (monthlies.length > 0) {
      lines.push('\n### 月报汇总');
      for (const s of monthlies) {
        lines.push(`\n#### ${s.startDate.getFullYear()}-${s.startDate.getMonth() + 1} 月报`);
        lines.push(s.content);
      }
    }

    if (quarterlies.length > 0) {
      lines.push('\n### 季报汇总');
      for (const s of quarterlies) {
        const q = Math.ceil((s.startDate.getMonth() + 1) / 3);
        lines.push(`\n#### ${s.startDate.getFullYear()} Q${q} 季报`);
        lines.push(s.content);
      }
    }

    return lines.join('\n');
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
