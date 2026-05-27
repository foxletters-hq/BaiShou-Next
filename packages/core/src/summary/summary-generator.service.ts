import {
  MissingSummary,
  SummaryType,
  logger,
  getSummaryRawDataPrefix,
  type SummaryPromptLocale
} from '@baishou/shared'
import { DiaryRepository, SummaryRepository } from '@baishou/database'
import {
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt
} from './summary-prompt-templates'

export interface SummaryAiClient {
  generateContent(prompt: string, modelId: string): Promise<string>
}

export class SummaryGeneratorService {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository,
    private readonly aiClient: SummaryAiClient,
    private readonly customTemplates?: Record<string, string>,
    private readonly promptLocale: SummaryPromptLocale = 'zh'
  ) {}

  async *generate(target: MissingSummary, modelId: string = 'gpt-4'): AsyncGenerator<string> {
    yield 'STATUS:reading_data'

    let contextData = ''
    let promptTemplate = ''

    try {
      const startDate =
        target.startDate instanceof Date ? target.startDate : new Date(target.startDate)
      const endDate = target.endDate instanceof Date ? target.endDate : new Date(target.endDate)
      const year = startDate.getFullYear()
      const month = startDate.getMonth() + 1
      const startStr = startDate.toISOString().split('T')[0] ?? ''
      const endStr = endDate.toISOString().split('T')[0] ?? ''

      switch (target.type) {
        case SummaryType.weekly:
          contextData = await this.buildWeeklyContext(startDate, endDate)
          // 计算周数
          const firstDayOfYear = new Date(year, 0, 1)
          const weekNum = Math.ceil(
            (startDate.getTime() - firstDayOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000) + 1
          )
          promptTemplate = buildWeeklyPrompt({
            year,
            month,
            week: weekNum,
            start: startStr,
            end: endStr,
            customTemplate: this.customTemplates?.weekly,
            locale: this.promptLocale
          })
          break
        case SummaryType.monthly:
          contextData = await this.buildMonthlyContext(startDate, endDate)
          promptTemplate = buildMonthlyPrompt({
            year,
            month,
            start: startStr,
            end: endStr,
            customTemplate: this.customTemplates?.monthly,
            locale: this.promptLocale
          })
          break
        case SummaryType.quarterly:
          contextData = await this.buildQuarterlyContext(startDate, endDate)
          const quarter = Math.ceil(month / 3)
          promptTemplate = buildQuarterlyPrompt({
            year,
            quarter,
            start: startStr,
            end: endStr,
            customTemplate: this.customTemplates?.quarterly,
            locale: this.promptLocale
          })
          break
        case SummaryType.yearly:
          contextData = await this.buildYearlyContext(startDate, endDate)
          promptTemplate = buildYearlyPrompt({
            year,
            start: startStr,
            end: endStr,
            customTemplate: this.customTemplates?.yearly,
            locale: this.promptLocale
          })
          break
      }

      if (!contextData) {
        logger.warn(
          `[SummaryGeneratorService] No context data found for target: ${target.type} (${startStr} to ${endStr})`
        )
        yield 'STATUS:no_data_error'
        return
      }

      logger.info(
        `[SummaryGeneratorService] Context data successfully built. Prompt template size: ${promptTemplate.length} chars. Context data size: ${contextData.length} chars.`
      )
      yield `STATUS:thinking_via_${modelId}`

      const dataPrefix = getSummaryRawDataPrefix(this.promptLocale)
      const combinedPrompt = `${promptTemplate}\n\n---\n\n${dataPrefix}\n\n${contextData}`
      logger.info(
        `[SummaryGeneratorService] Dispatching prompt to AI client (Model: ${modelId})...`
      )
      const generatedResult = await this.aiClient.generateContent(combinedPrompt, modelId)

      logger.info(
        `[SummaryGeneratorService] AI generation successfully retrieved. Content size: ${generatedResult.length} chars.`
      )
      yield generatedResult
    } catch (e: any) {
      logger.error(
        `[SummaryGeneratorService] Failed to generate summary for target ${target.type}:`,
        e
      )
      const safeMsg = this.sanitizeError(e)
      yield `STATUS:generation_failed_error: ${safeMsg}`
      throw new Error(safeMsg)
    }
  }

  private async buildWeeklyContext(start: Date, end: Date): Promise<string> {
    const diaries = await this.diaryRepo.findByDateRange(start, end)
    if (!diaries.length) return ''
    return diaries
      .map((d) => {
        const dateStr = d.date.toISOString().split('T')[0] ?? ''
        const content = d.content || '（无内容）'
        const tags = d.tags || '无标签'
        return `#### ${dateStr}\n${content}\n标签: ${tags}`
      })
      .join('\n\n')
  }

  private async buildMonthlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({
      start: new Date(start.getTime() - 1)
    })
    const weeklies = summaries.filter(
      (s) =>
        s.type === SummaryType.weekly &&
        s.startDate.getTime() >= start.getTime() &&
        s.endDate.getTime() <= end.getTime()
    )

    if (!weeklies.length) return ''
    return weeklies
      .map((w) => {
        const startStr = w.startDate.toISOString().split('T')[0] ?? ''
        const endStr = w.endDate.toISOString().split('T')[0] ?? ''
        const content = w.content || '（无内容）'
        return `#### ${startStr} 至 ${endStr} (周记)\n${content}`
      })
      .join('\n\n')
  }

  private async buildQuarterlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({
      start: new Date(start.getTime() - 1)
    })
    const monthlies = summaries.filter(
      (s) =>
        s.type === SummaryType.monthly &&
        s.startDate.getTime() >= start.getTime() &&
        s.endDate.getTime() <= end.getTime()
    )

    if (!monthlies.length) return ''
    return monthlies
      .map((m) => {
        const dateStr = m.startDate.toISOString().split('T')[0] ?? ''
        const content = m.content || '（无内容）'
        return `#### ${dateStr} (月报)\n${content}`
      })
      .join('\n\n')
  }

  private async buildYearlyContext(start: Date, end: Date): Promise<string> {
    const summaries = await this.summaryRepo.getSummaries({
      start: new Date(start.getTime() - 1)
    })
    const quarterlies = summaries.filter(
      (s) =>
        s.type === SummaryType.quarterly &&
        s.startDate.getTime() >= start.getTime() &&
        s.endDate.getTime() <= end.getTime()
    )

    if (!quarterlies.length) return ''
    return quarterlies
      .map((q) => {
        const content = q.content || '（无内容）'
        return `#### (季度总结)\n${content}`
      })
      .join('\n\n')
  }

  private sanitizeError(e: any): string {
    let msg = e?.message || String(e)
    msg = msg.replace(/(key|api_key|Authorization)=[A-Za-z0-9\-_]+/g, '$1=******')

    if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      return `Network or connection issue: ${msg}`
    }
    return msg
  }
}
