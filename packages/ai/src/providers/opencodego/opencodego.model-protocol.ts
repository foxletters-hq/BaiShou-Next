import { ProviderType } from '@baishou/shared'
import { OPENCODE_GO_ANTHROPIC_WIRE_MODEL_IDS } from './opencodego.constants'

/** OpenCode Go 底层实际使用的 wire 协议 */
export type OpenCodeGoWireProtocol = 'openai' | 'anthropic'

/**
 * 根据模型 ID 判定应使用的 wire 协议。
 * 新模型未列入文档时，按 minimax-/qwen 前缀启发式归入 Anthropic。
 */
export function resolveOpenCodeGoWireProtocol(modelId: string): OpenCodeGoWireProtocol {
  const normalized = modelId.trim().toLowerCase()
  if (!normalized) {
    return 'openai'
  }
  if (OPENCODE_GO_ANTHROPIC_WIRE_MODEL_IDS.has(normalized)) {
    return 'anthropic'
  }
  if (/^(minimax-|qwen)/.test(normalized)) {
    return 'anthropic'
  }
  return 'openai'
}

/**
 * 将逻辑供应商类型解析为中间件 / 缓存策略所需的实际协议类型。
 * OpenCode Go 在模型级别混用 OpenAI 与 Anthropic wire。
 */
export function resolveEffectiveProviderType(providerType: string, modelId?: string): string {
  if (providerType === ProviderType.OpenCodeGo && modelId?.trim()) {
    return resolveOpenCodeGoWireProtocol(modelId)
  }
  return providerType
}
