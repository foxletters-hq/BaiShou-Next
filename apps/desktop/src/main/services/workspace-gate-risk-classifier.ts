import { streamText } from 'ai'
import {
  wrapLanguageModelWithMiddlewares,
  buildSmallTaskReasoningProviderOptions,
  type AgentGateRiskClassifier,
  type AgentGateRiskClassifierInput,
  type AgentGateRiskClassifierResult
} from '@baishou/ai'
import {
  AI_FIRST_OUTPUT_TIMEOUT_MS,
  WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS,
  i18n,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger,
  resolveProviderModelSlot,
  type AgentGatePreview
} from '@baishou/shared'
import { getActiveProvider } from '../ipc/agent-helpers'
import { settingsManager } from '../ipc/settings.ipc'

const CLASSIFIER_MAX_OUTPUT_TOKENS = 48

function readClassifierPartText(part: { text?: unknown; textDelta?: unknown }): string {
  if (typeof part.text === 'string' && part.text) return part.text
  if (typeof part.textDelta === 'string' && part.textDelta) return part.textDelta
  return ''
}

type GlobalModelsConfig = {
  globalNamingProviderId?: string
  globalNamingModelId?: string
}

function summarizePreview(preview?: AgentGatePreview): string {
  if (!preview) return ''
  if (preview.type === 'command') {
    return `command=${preview.command.slice(0, 400)}`
  }
  if (preview.type === 'file_change') {
    const pathHint = preview.path?.slice(0, 200) ?? ''
    const diffHint = preview.diff?.slice(0, 400) ?? preview.contentDigest?.slice(0, 200) ?? ''
    return `file_change path=${pathHint} kind=${preview.kind ?? ''} ${diffHint}`
  }
  if (preview.type === 'content') {
    return `content subject=${preview.subject.slice(0, 120)} summary=${(preview.summary ?? '').slice(0, 300)}`
  }
  return ''
}

function buildClassifierPrompt(input: AgentGateRiskClassifierInput): string {
  const shell =
    input.resources
      ?.filter((r) => r.kind === 'shell_command')
      .map((r) => r.value)
      .join(' | ')
      .slice(0, 400) ?? ''
  const preview = summarizePreview(input.preview)
  return [
    WORKSPACE_GATE_RISK_CLASSIFIER_INSTRUCTIONS,
    '',
    `action: ${input.action}`,
    `title: ${input.title.slice(0, 200)}`,
    input.description ? `description: ${input.description.slice(0, 200)}` : '',
    shell ? `shell: ${shell}` : '',
    preview ? `preview: ${preview}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function parseClassifierText(text: string): AgentGateRiskClassifierResult {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; reason?: string }
      if (parsed.verdict === 'allow' || parsed.verdict === 'ask') {
        return {
          verdict: parsed.verdict,
          reason: typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 80) : undefined
        }
      }
    } catch {
      // fall through
    }
  }
  const lower = trimmed.toLowerCase()
  if (/\ballow\b/.test(lower) && !/\bask\b/.test(lower)) {
    return { verdict: 'allow' }
  }
  return {
    verdict: 'ask',
    reason: i18n.t('settings.agent_gate_auto_review_parse_failed', '自动审核未能解析模型输出')
  }
}

/**
 * 工作台 auto_review：只用命名模型做风险分类。
 * 首字超时与其它生成请求共用；没配命名模型时不改用对话模型，直接改为需要确认。
 */
export const classifyWorkspaceGateRisk: AgentGateRiskClassifier = async (input) => {
  try {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const providers =
      (await settingsManager.get<Array<{ id: string; isEnabled?: boolean }>>('ai_providers')) || []
    const hit = resolveProviderModelSlot(providers, [
      {
        providerId: globalModels?.globalNamingProviderId,
        modelId: globalModels?.globalNamingModelId
      }
    ])
    const providerId = hit?.providerId
    const modelId = hit?.modelId
    if (
      !providerId ||
      !modelId ||
      !isConfiguredProviderId(providerId) ||
      !isConfiguredDialogueModelId(modelId)
    ) {
      return {
        verdict: 'ask',
        reason: i18n.t(
          'settings.agent_gate_auto_review_no_model',
          '还没配置命名模型，已改为需要确认'
        )
      }
    }

    const provider = await getActiveProvider(providerId)
    const baseModel = provider.getLanguageModel(modelId)
    const model = wrapLanguageModelWithMiddlewares(baseModel, {
      providerType: provider.config?.type || 'openai',
      providerId: provider.config?.id,
      modelId,
      sessionId: input.sessionId,
      baseUrl: provider.config?.baseUrl
    })

    const abortController = new AbortController()
    let firstOutputSeen = false
    let timedOut = false
    const timeoutId = setTimeout(() => {
      if (firstOutputSeen) return
      timedOut = true
      abortController.abort()
    }, AI_FIRST_OUTPUT_TIMEOUT_MS)
    const markFirstOutput = () => {
      if (firstOutputSeen) return
      firstOutputSeen = true
      clearTimeout(timeoutId)
    }
    try {
      const reasoningOptions = buildSmallTaskReasoningProviderOptions({
        modelId,
        providerType: provider.config?.type || 'openai'
      })
      const streamResult = streamText({
        model,
        prompt: buildClassifierPrompt(input),
        temperature: 0,
        maxOutputTokens: CLASSIFIER_MAX_OUTPUT_TOKENS,
        abortSignal: abortController.signal,
        ...(reasoningOptions ? { providerOptions: reasoningOptions as never } : {})
      })
      let text = ''
      for await (const part of streamResult.fullStream) {
        const typed = part as { type?: string; text?: unknown; textDelta?: unknown }
        if (
          typed.type !== 'text-delta' &&
          typed.type !== 'reasoning-delta' &&
          typed.type !== 'reasoning'
        ) {
          continue
        }
        const piece = readClassifierPartText(typed)
        if (!piece) continue
        markFirstOutput()
        if (typed.type === 'text-delta') text += piece
      }
      if (timedOut) {
        return {
          verdict: 'ask',
          reason: i18n.t('settings.agent_gate_auto_review_failed', '自动审核失败，已改为需要确认')
        }
      }
      return parseClassifierText(text)
    } catch (error) {
      if (timedOut) {
        return {
          verdict: 'ask',
          reason: i18n.t('settings.agent_gate_auto_review_failed', '自动审核失败，已改为需要确认')
        }
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn('[auto_review] risk classifier failed:', msg)
    return {
      verdict: 'ask',
      reason: i18n.t('settings.agent_gate_auto_review_failed', '自动审核失败，已改为需要确认')
    }
  }
}
