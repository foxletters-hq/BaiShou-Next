import { MissingSummary, SummaryType } from '@baishou/shared';
import { DiaryRepository } from '@baishou/database/src/repositories/diary.repository';
import { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';

export interface SummaryAiClient {
  generateContent(prompt: string, modelId: string): Promise<string>;
}

export class SummaryGeneratorService {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository,
    private readonly aiClient: SummaryAiClient
  ) {}

  async *generate(target: MissingSummary, modelId: string = 'gpt-4'): AsyncGenerator<string> {
    yield 'STATUS:reading_data';
    
    let contextData = '';
    let promptTemplate = '';

    try {
      switch (target.type) {
        case SummaryType.weekly:
          contextData = await this.buildWeeklyContext(target.startDate, target.endDate);
          promptTemplate = 'Please write a weekly summary for the provided diaries:\n';
          break;
        case SummaryType.monthly:
          contextData = await this.buildMonthlyContext(target.startDate, target.endDate);
          promptTemplate = 'Please formulate a monthly summary based on the weeklies and diaries:\n';
          break;
        case SummaryType.quarterly:
          contextData = await this.buildQuarterlyContext(target.startDate, target.endDate);
          promptTemplate = 'Extract the core quarterly summary from these past 3 month insights:\n';
          break;
        case SummaryType.yearly:
          contextData = await this.buildYearlyContext(target.startDate, target.endDate);
          promptTemplate = 'Write the comprehensive end-of-year review out of the past quarters:\n';
          break;
      }

      if (!contextData) {
        yield 'STATUS:no_data_error';
        return;
      }

      yield `STATUS:thinking_via_${modelId}`;

      const combinedPrompt = `${promptTemplate}\n\n${contextData}`;
      const generatedResult = await this.aiClient.generateContent(combinedPrompt, modelId);
      
      yield generatedResult;

    } catch (e: any) {
      const safeMsg = this.sanitizeError(e);
      yield `STATUS:generation_failed_error: ${safeMsg}`;
      throw new Error(safeMsg);
    }
  }

  private async buildWeeklyContext(start: Date, end: Date): Promise<string> {
    const diaries = await this.diaryRepo.findByDateRange(start, end);
    if (!diaries.length) return '';
    return diaries.map(d => `#### ${d.date.toISOString().split('T')[0]}\n${d.content}\nTags: ${d.tags}`).join('\n\n');
  }

  private async buildMonthlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({ start: new Date(start.getTime() - 1) });
    const weeklies = summaries.filter(s => 
      s.type === SummaryType.weekly && s.startDate.getTime() >= start.getTime() && s.endDate.getTime() <= end.getTime()
    );

    if (!weeklies.length) return '';
    return weeklies.map(w => `#### ${w.startDate.toISOString().split('T')[0]} to ${w.endDate.toISOString().split('T')[0]} (Weekly)\n${w.content}`).join('\n\n');
  }

  private async buildQuarterlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({ start: new Date(start.getTime() - 1) });
    const monthlies = summaries.filter(s => 
      s.type === SummaryType.monthly && s.startDate.getTime() >= start.getTime() && s.endDate.getTime() <= end.getTime()
    );

    if (!monthlies.length) return '';
    return monthlies.map(m => `#### ${m.startDate.toISOString().split('T')[0]} (Monthly)\n${m.content}`).join('\n\n');
  }

  private async buildYearlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({ start: new Date(start.getTime() - 1) });
    const quarterlies = summaries.filter(s => 
      s.type === SummaryType.quarterly && s.startDate.getTime() >= start.getTime() && s.endDate.getTime() <= end.getTime()
    );

    if (!quarterlies.length) return '';
    return quarterlies.map(q => `#### (Quarterly)\n${q.content}`).join('\n\n');
  }

  private sanitizeError(e: any): string {
    let msg = e?.message || String(e);
    msg = msg.replace(/(key|api_key|Authorization)=[A-Za-z0-9\-_]+/g, '$1=******');
    
    if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      return `Network or connection issue: ${msg}`;
    }
    return msg;
  }
}
