import i18n from 'i18next'
import {
  MissingSummary,
  SummaryType,
  logger,
  getSummaryRawDataPrefix,
  getSummaryWeekNumber,
  formatLocalDate,
  assembleSummaryGenerationPrompt,
  type SummaryPromptLocale
} from '@baishou/shared'
import { DiaryRepository, SummaryRepository } from '@baishou/database'
import {
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt
} from './summary-prompt-templates'

export interface SummaryAiGenerateOptions {
  system?: string
  providerId?: string
  /** 用户取消 / 队列停止时中止 generateText */
  abortSignal?: AbortSignal
}

export interface SummaryAiClient {
  generateContent(
    prompt: string,
    modelId: string,
    options?: SummaryAiGenerateOptions
  ): Promise<string>
}

export interface SummaryGenerateOptions {
  modelId?: string
  providerId?: string
  systemPrompt?: string
  /** 覆盖构造时的模板（便于移动端每次任务热读配置） */
  customTemplates?: Record<string, string>
  promptLocale?: SummaryPromptLocale
  /** 已组装的共同回忆正文；空字符串或缺省则不注入 */
  sharedContextText?: string
  /** 月报上下文：仅周记，或周记 + 本月日记 */
  monthlySummarySource?: 'weeklies' | 'diaries'
  /** 用户取消时中止底层 LLM 请求 */
  abortSignal?: AbortSignal
}

function normalizeGenerateOptions(
  modelIdOrOptions: string | SummaryGenerateOptions | undefined
): Required<Pick<SummaryGenerateOptions, 'modelId'>> & SummaryGenerateOptions {
  if (typeof modelIdOrOptions === 'string' || modelIdOrOptions === undefined) {
    return { modelId: modelIdOrOptions ?? 'gpt-4' }
  }
  return {
    ...modelIdOrOptions,
    modelId: modelIdOrOptions.modelId ?? 'gpt-4'
  }
}

export class SummaryGeneratorService {
  constructor(
    private readonly diaryRepo: DiaryRepository,
    private readonly summaryRepo: SummaryRepository,
    private readonly aiClient: SummaryAiClient,
    private readonly customTemplates?: Record<string, string>,
    private readonly promptLocale: SummaryPromptLocale = 'zh'
  ) {}

  async *generate(
    target: MissingSummary,
    modelIdOrOptions: string | SummaryGenerateOptions = 'gpt-4'
  ): AsyncGenerator<string> {
    yield 'STATUS:reading_data'

    const options = normalizeGenerateOptions(modelIdOrOptions)
    const modelId = options.modelId
    const templates = options.customTemplates ?? this.customTemplates
    const promptLocale = options.promptLocale ?? this.promptLocale

    let contextData = ''
    let promptTemplate = ''

    try {
      const startDate =
        target.startDate instanceof Date ? target.startDate : new Date(target.startDate)
      const endDate = target.endDate instanceof Date ? target.endDate : new Date(target.endDate)
      const year = startDate.getFullYear()
      const month = startDate.getMonth() + 1
      const startStr = formatLocalDate(startDate)
      const endStr = formatLocalDate(endDate)

      switch (target.type) {
        case SummaryType.weekly:
          contextData = await this.buildWeeklyContext(startDate, endDate)
          const weekNum = getSummaryWeekNumber(startDate)
          promptTemplate = buildWeeklyPrompt({
            year,
            month,
            week: weekNum,
            start: startStr,
            end: endStr,
            customTemplate: templates?.weekly,
            locale: promptLocale
          })
          break
        case SummaryType.monthly:
          contextData = await this.buildMonthlyContext(
            startDate,
            endDate,
            options.monthlySummarySource
          )
          promptTemplate = buildMonthlyPrompt({
            year,
            month,
            start: startStr,
            end: endStr,
            customTemplate: templates?.monthly,
            locale: promptLocale
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
            customTemplate: templates?.quarterly,
            locale: promptLocale
          })
          break
        case SummaryType.yearly:
          contextData = await this.buildYearlyContext(startDate, endDate)
          promptTemplate = buildYearlyPrompt({
            year,
            start: startStr,
            end: endStr,
            customTemplate: templates?.yearly,
            locale: promptLocale
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

      const dataPrefix = getSummaryRawDataPrefix(promptLocale)
      const combinedPrompt = assembleSummaryGenerationPrompt({
        promptTemplate,
        dataPrefix,
        contextData,
        sharedContextText: options.sharedContextText,
        promptLocale
      })
      if (options.abortSignal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      logger.info(
        `[SummaryGeneratorService] Dispatching prompt to AI client (Model: ${modelId})...`
      )
      const generatedResult = await this.aiClient.generateContent(combinedPrompt, modelId, {
        system: options.systemPrompt,
        providerId: options.providerId,
        abortSignal: options.abortSignal
      })

      if (options.abortSignal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }

      logger.info(
        `[SummaryGeneratorService] AI generation successfully retrieved. Content size: ${generatedResult.length} chars.`
      )
      yield generatedResult
    } catch (e: any) {
      if (e?.name === 'AbortError' || options.abortSignal?.aborted) {
        throw e instanceof Error ? e : new DOMException('The operation was aborted', 'AbortError')
      }
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
        const dateStr = formatLocalDate(d.date)
        const content =
          d.content ||
          i18n.t('auto.packages.core.src.summary.summary.generator.service.L136', '（无内容）')
        const tags =
          d.tags ||
          i18n.t('auto.packages.core.src.summary.summary.generator.service.L137', '无标签')
        return `#### ${dateStr}\n${content}\n标签: ${tags}`
      })
      .join('\n\n')
  }

  private async buildMonthlyContext(
    start: Date,
    end: Date,
    source: 'weeklies' | 'diaries' = 'weeklies'
  ): Promise<string> {
    const weekliesText = await this.buildMonthlyWeekliesContext(start, end)
    if (source !== 'diaries') {
      return weekliesText
    }

    const diariesText = await this.buildWeeklyContext(start, end)
    return [weekliesText, diariesText].filter((part) => part.trim().length > 0).join('\n\n')
  }

  private async buildMonthlyWeekliesContext(start: Date, end: Date): Promise<string> {
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
        const startStr = formatLocalDate(w.startDate)
        const endStr = formatLocalDate(w.endDate)
        const content =
          w.content ||
          i18n.t('auto.packages.core.src.summary.summary.generator.service.L159', '（无内容）')
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
        const dateStr = formatLocalDate(m.startDate)
        const content =
          m.content ||
          i18n.t('auto.packages.core.src.summary.summary.generator.service.L180', '（无内容）')
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
        const content =
          q.content ||
          i18n.t('auto.packages.core.src.summary.summary.generator.service.L200', '（无内容）')
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
