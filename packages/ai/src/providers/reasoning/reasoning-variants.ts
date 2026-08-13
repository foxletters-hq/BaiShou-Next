import {
  type ReasoningEffort,
  getReasoningControlForModel,
  isOpenAiStyleReasoningModel,
  isAnthropicReasoningModel,
  isGeminiReasoningModel,
  isGlm52ReasoningModel,
  isMiniMaxM3Model,
  isDeepSeekV4Model,
  isReasoningCapableModel,
  listOpenAiStyleReasoningEfforts,
  listAnthropicReasoningEfforts,
  listGeminiReasoningEfforts,
  listDeepSeekReasoningEfforts,
  formatReasoningEffortLabel,
  WIDELY_SUPPORTED_EFFORTS,
  normalizeModelBaseId
} from '@baishou/shared'
import { resolveReasoningApiShape, type ReasoningApiShapeContext } from './reasoning-api-shape'

export type ReasoningVariant = {
  id: ReasoningEffort
  /** 固定英文展示，不做 i18n */
  label: string
}

export type ListReasoningVariantsContext = ReasoningApiShapeContext

export function listReasoningVariants(ctx: ListReasoningVariantsContext): ReasoningVariant[] {
  const modelId = ctx.modelId?.trim() || ''
  if (!modelId) return []
  if (!isReasoningCapableModel(modelId, ctx.providerType)) return []

  const control = getReasoningControlForModel(modelId, ctx.providerType)
  if (control.supportsToggle || control.mode === 'toggle') {
    // none=关, high=开（auto 在 build 侧单独处理）
    return [
      { id: 'none', label: formatReasoningEffortLabel('none') },
      { id: 'high', label: formatReasoningEffortLabel('high') }
    ]
  }

  const shape = resolveReasoningApiShape(ctx)
  let efforts: ReasoningEffort[] = []
  const type = (ctx.providerType || '').toLowerCase()

  switch (shape) {
    case 'responses':
    case 'chat':
      if (control.mode === 'effort' && control.efforts?.length) {
        efforts = control.efforts
        break
      }
      if (isDeepSeekV4Model(modelId)) {
        efforts = listDeepSeekReasoningEfforts(modelId)
        break
      }
      efforts = listOpenAiStyleReasoningEfforts(modelId)
      if (efforts.length === 0 && isGlm52ReasoningModel(modelId)) {
        efforts = ['high', 'max']
      }
      if (efforts.length === 0 && isMiniMaxM3Model(modelId)) {
        efforts = ['none', 'high']
      }
      if (efforts.length === 0 && type === 'grok' && /grok-3-mini/.test(normalizeModelBaseId(modelId))) {
        efforts = ['low', 'high']
      }
      break
    case 'anthropic':
      if (isMiniMaxM3Model(modelId)) {
        efforts = ['none', 'high']
      } else {
        efforts = listAnthropicReasoningEfforts(modelId)
      }
      break
    case 'gemini':
      efforts = listGeminiReasoningEfforts(modelId)
      break
    case 'openrouter':
      if (isGlm52ReasoningModel(modelId)) {
        efforts = ['high', 'xhigh']
      } else if (isDeepSeekV4Model(modelId)) {
        efforts = listDeepSeekReasoningEfforts(modelId)
      } else if (isOpenAiStyleReasoningModel(modelId)) {
        efforts = listOpenAiStyleReasoningEfforts(modelId)
      } else if (isGeminiReasoningModel(modelId)) {
        efforts = listGeminiReasoningEfforts(modelId)
      } else if (isAnthropicReasoningModel(modelId)) {
        efforts = listAnthropicReasoningEfforts(modelId)
      } else if (/grok-3-mini/.test(normalizeModelBaseId(modelId))) {
        efforts = ['low', 'high']
      } else {
        efforts = [...WIDELY_SUPPORTED_EFFORTS]
      }
      break
    default:
      efforts = []
  }

  return efforts.map((id) => ({
    id,
    label: formatReasoningEffortLabel(id)
  }))
}
