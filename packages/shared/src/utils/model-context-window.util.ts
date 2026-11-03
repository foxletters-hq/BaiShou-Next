import { normalizeModelBaseId } from './provider-vision-models'

/** 未知模型时的保守默认上下文窗口 */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 128_000

/** 已知模型 id 子串 → 上下文窗口（token）。命中第一条匹配。 */
const MODEL_CONTEXT_WINDOW_TABLE: Array<{ match: RegExp; window: number }> = [
  { match: /claude.*(opus|sonnet|haiku)|claude-3|claude-4|claude-3-5/i, window: 200_000 },
  { match: /gemini.*(1\.5-pro|1\.5.*pro)/i, window: 2_000_000 },
  { match: /gemini.*(1\.5|2\.0|2\.5|pro|flash)/i, window: 1_000_000 },
  { match: /gpt-4\.1|gpt-4o|gpt-4-turbo|o1|o3|o4/i, window: 128_000 },
  { match: /gpt-4(?![.\d])/i, window: 8_192 },
  { match: /gpt-3\.5/i, window: 16_385 },
  { match: /deepseek.*v4|deepseek-v4|deepseek-flash/i, window: 1_000_000 },
  { match: /deepseek.*(v3|r1|reasoner)|deepseek-chat/i, window: 128_000 },
  { match: /deepseek/i, window: 64_000 },
  { match: /qwen.*long/i, window: 1_000_000 },
  { match: /qwen.*(max|plus|turbo|2\.5|3)|qwen2|qwen3/i, window: 128_000 },
  { match: /qwen/i, window: 32_768 },
  { match: /(kimi|moonshot)/i, window: 128_000 },
  { match: /(glm|chatglm).*long/i, window: 1_000_000 },
  { match: /(glm|chatglm)/i, window: 128_000 },
  { match: /(yi|01-ai)/i, window: 200_000 },
  { match: /grok.*(4\.1-fast|4-fast|4\.20)/i, window: 2_000_000 },
  { match: /grok.*4\.3/i, window: 1_000_000 },
  { match: /grok.*(4\.5|4\.6|4\.7|latest)/i, window: 500_000 },
  { match: /grok.*(build|code)/i, window: 256_000 },
  { match: /grok.*4(?![.\d])/i, window: 256_000 },
  { match: /grok/i, window: 131_072 },
  { match: /minimax.*(01|text-01)/i, window: 1_000_000 },
  { match: /minimax|abab/i, window: 245_760 },
  { match: /(llama-3|llama3)/i, window: 128_000 },
  { match: /mistral|mixtral/i, window: 32_768 }
]

let runtimeModelContextWindows: Map<string, number> | null = null

export function extractModelContextWindowsFromModelsDev(data: unknown): Record<string, number> {
  const result: Record<string, number> = {}
  if (!data || typeof data !== 'object') return result

  for (const provider of Object.values(data as Record<string, any>)) {
    if (!provider?.models || typeof provider.models !== 'object') continue
    for (const [modelId, model] of Object.entries<any>(provider.models)) {
      const context = model?.limit?.context
      if (typeof context === 'number' && Number.isFinite(context) && context > 0) {
        result[modelId] = context
        const normalized = normalizeModelBaseId(modelId)
        if (normalized && !result[normalized]) {
          result[normalized] = context
        }
      }
    }
  }
  return result
}

export function applyModelContextWindowRuntimeOverlay(
  windows: Record<string, number> | Map<string, number>
): void {
  runtimeModelContextWindows = new Map(
    windows instanceof Map ? windows : Object.entries(windows)
  )
}

export function getModelContextWindowRuntimeOverlay(): Record<string, number> {
  if (!runtimeModelContextWindows) return {}
  return Object.fromEntries(runtimeModelContextWindows.entries())
}

export function resetModelContextWindowRuntimeOverlayForTests(): void {
  runtimeModelContextWindows = null
}

/** 估算模型上下文窗口（token）；未知返回默认值；override 优先 */
export function getModelContextWindow(
  modelId?: string | null,
  overrideWindow?: number | null
): number {
  if (overrideWindow != null && overrideWindow > 0) return overrideWindow
  if (!modelId) return DEFAULT_MODEL_CONTEXT_WINDOW

  if (runtimeModelContextWindows) {
    const exact = runtimeModelContextWindows.get(modelId)
    if (exact != null && exact > 0) return exact
    const normalized = runtimeModelContextWindows.get(normalizeModelBaseId(modelId))
    if (normalized != null && normalized > 0) return normalized
  }

  for (const entry of MODEL_CONTEXT_WINDOW_TABLE) {
    if (entry.match.test(modelId)) return entry.window
  }
  return DEFAULT_MODEL_CONTEXT_WINDOW
}
