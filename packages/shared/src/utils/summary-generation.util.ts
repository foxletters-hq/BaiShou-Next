import {
  clampSharedMemoryLookbackMonths,
  DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
} from '../types/summary.types'
import type {
  AIProviderConfig,
  SummaryConfig,
  SummaryGenerationMode
} from '../types/settings.types'
import type { SummaryPromptLocale } from '../types/summary-prompt.types'
import { getDefaultCustomGenerationSystemPrompt } from '../constants/summary-generation-system-prompt.defaults'
import { canUseProviderModel } from './summary-config.util'
import { resolveSummaryPromptLocale } from './summary-template.util'

export interface SummaryAssistantSnapshot {
  id: string
  name?: string
  systemPrompt?: string | null
  providerId?: string | null
  modelId?: string | null
}

export interface ResolvedSummaryGeneration {
  mode: SummaryGenerationMode
  providerId?: string
  modelId?: string
  systemPrompt?: string
  injectSharedMemoryBeforeGenerate: boolean
  sharedMemoryLookbackMonths: number
  /** 请求伙伴模式但伙伴缺失/不完整/模型不可用时回退提示词模式 */
  fellBackToPrompt: boolean
}

export function normalizeSummaryGenerationMode(value: unknown): SummaryGenerationMode {
  return value === 'assistant' ? 'assistant' : 'prompt'
}

/** 自定义提示词模式下的生成回忆助手 system prompt（按 promptLocale；空则用出厂默认） */
export function resolveCustomGenerationSystemPrompt(
  config: SummaryConfig | null | undefined,
  locale?: string
): string | undefined {
  const promptLocale = resolveSummaryPromptLocale(locale ?? config?.promptLocale)
  const text = config?.customGenerationSystemPromptByLocale?.[promptLocale]?.trim()
  return text || getDefaultCustomGenerationSystemPrompt(promptLocale)
}

function promptModeRuntime(
  config: SummaryConfig | null | undefined,
  injectSharedMemoryBeforeGenerate: boolean,
  sharedMemoryLookbackMonths: number,
  fellBackToPrompt: boolean
): ResolvedSummaryGeneration {
  return {
    mode: 'prompt',
    systemPrompt: resolveCustomGenerationSystemPrompt(config),
    injectSharedMemoryBeforeGenerate,
    sharedMemoryLookbackMonths,
    fellBackToPrompt
  }
}

export function resolveSummaryGenerationRuntime(
  config: SummaryConfig | null | undefined,
  assistant: SummaryAssistantSnapshot | null | undefined,
  providers?: AIProviderConfig[] | null
): ResolvedSummaryGeneration {
  const injectSharedMemoryBeforeGenerate = !!config?.injectSharedMemoryBeforeGenerate
  const sharedMemoryLookbackMonths =
    config?.sharedMemoryLookbackMonths !== undefined
      ? clampSharedMemoryLookbackMonths(config.sharedMemoryLookbackMonths)
      : DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS

  const requestedMode = normalizeSummaryGenerationMode(config?.generationMode)
  if (requestedMode !== 'assistant') {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      false
    )
  }

  const assistantId = config?.generationAssistantId?.trim()
  if (!assistantId || !assistant || String(assistant.id) !== assistantId) {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      true
    )
  }

  const providerId = assistant.providerId?.trim()
  const modelId = assistant.modelId?.trim()
  if (!providerId || !modelId) {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      true
    )
  }

  if (providers && !canUseProviderModel(providers, providerId, modelId)) {
    return promptModeRuntime(
      config,
      injectSharedMemoryBeforeGenerate,
      sharedMemoryLookbackMonths,
      true
    )
  }

  const systemPrompt = assistant.systemPrompt?.trim()
  return {
    mode: 'assistant',
    providerId,
    modelId,
    systemPrompt: systemPrompt || undefined,
    injectSharedMemoryBeforeGenerate,
    sharedMemoryLookbackMonths,
    fellBackToPrompt: false
  }
}

const SHARED_MEMORY_INJECT_TITLE: Record<SummaryPromptLocale, string> = {
  zh: '## 共同回忆（生成前注入，用于保持连贯性）',
  en: '## Shared Memory (injected before generation for continuity)',
  ja: '## 共有の思い出（一貫性のため生成前に注入）',
  'zh-TW': '## 共同回憶（生成前注入，用於保持連貫性）'
}

export function getSummarySharedMemoryInjectTitle(locale?: string): string {
  return SHARED_MEMORY_INJECT_TITLE[resolveSummaryPromptLocale(locale)]
}

/** 组装总结生成的 user prompt：模板 → 可选共同回忆 → 本期原始数据 */
export function assembleSummaryGenerationPrompt(params: {
  promptTemplate: string
  dataPrefix: string
  contextData: string
  sharedContextText?: string
  sharedMemorySectionTitle?: string
  promptLocale?: string
}): string {
  const parts: string[] = [params.promptTemplate]
  const shared = params.sharedContextText?.trim()
  if (shared) {
    const title =
      params.sharedMemorySectionTitle ?? getSummarySharedMemoryInjectTitle(params.promptLocale)
    parts.push(`---\n\n${title}\n\n${shared}`)
  }
  parts.push(`---\n\n${params.dataPrefix}\n\n${params.contextData}`)
  return parts.join('\n\n')
}
