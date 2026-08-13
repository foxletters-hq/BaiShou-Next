import { generateText } from 'ai'
import {
  wrapLanguageModelWithMiddlewares,
  buildSmallTaskReasoningProviderOptions,
  type AgentGateRiskClassifier,
  type AgentGateRiskClassifierInput,
  type AgentGateRiskClassifierResult
} from '@baishou/ai'
import { i18n, logger, type AgentGatePreview } from '@baishou/shared'
import { getActiveProvider } from '../ipc/agent-helpers'
import { settingsManager } from '../ipc/settings.ipc'

const CLASSIFIER_TIMEOUT_MS = 6_000
const CLASSIFIER_MAX_OUTPUT_TOKENS = 48

type GlobalModelsConfig = {
  globalDialogueProviderId?: string
  globalDialogueModelId?: string
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
    '你是工作台 Agent 操作的安全审核器。判断该操作是否需要人类确认。',
    '只输出一行 JSON：{"verdict":"allow"|"ask","reason":"不超过40字"}',
    '规则：',
    '- allow：低风险、可逆、只读或常规编辑，可自动执行',
    '- ask：破坏性、不可逆、权限提升、批量删除、可疑命令、区外敏感写入等',
    '- 不确定时选 ask',
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
    reason: i18n.t(
      'settings.agent_gate_auto_review_parse_failed',
      '自动审核未能解析模型输出'
    )
  }
}

/**
 * 工作台 auto_review：用全局对话/命名模型做短超时风险分类。
 * 失败由调用方 fail-closed；本函数尽量返回 ask 而不是抛错。
 */
export const classifyWorkspaceGateRisk: AgentGateRiskClassifier = async (input) => {
  try {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const providerId =
      globalModels?.globalNamingProviderId ||
      globalModels?.globalDialogueProviderId ||
      undefined
    const modelId =
      globalModels?.globalNamingModelId || globalModels?.globalDialogueModelId || undefined
    if (!providerId || !modelId || modelId === 'default') {
      return {
        verdict: 'ask',
        reason: i18n.t(
          'settings.agent_gate_auto_review_no_model',
          '未配置可用模型，已改为需要确认'
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
    const timeoutId = setTimeout(() => abortController.abort('auto_review timeout'), CLASSIFIER_TIMEOUT_MS)
    try {
      const reasoningOptions = buildSmallTaskReasoningProviderOptions({
        modelId,
        providerType: provider.config?.type || 'openai'
      })
      const result = await generateText({
        model,
        prompt: buildClassifierPrompt(input),
        temperature: 0,
        maxOutputTokens: CLASSIFIER_MAX_OUTPUT_TOKENS,
        abortSignal: abortController.signal,
        ...(reasoningOptions ? { providerOptions: reasoningOptions } : {})
      })
      return parseClassifierText(result.text ?? '')
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
