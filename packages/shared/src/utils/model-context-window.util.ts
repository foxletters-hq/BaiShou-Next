/** 未知模型时的保守默认上下文窗口 */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 128_000

/** 已知模型 id 子串 → 上下文窗口（token）。命中第一条匹配。 */
const MODEL_CONTEXT_WINDOW_TABLE: Array<{ match: RegExp; window: number }> = [
  { match: /claude.*(opus|sonnet|haiku)|claude-3|claude-4|claude-3-5/i, window: 200_000 },
  { match: /gemini.*(1\.5|2\.0|2\.5|pro|flash)/i, window: 1_000_000 },
  { match: /gpt-4\.1|gpt-4o|gpt-4-turbo|o1|o3|o4/i, window: 128_000 },
  { match: /gpt-4(?![.\d])/i, window: 8_192 },
  { match: /gpt-3\.5/i, window: 16_385 },
  { match: /deepseek.*v4|deepseek-v4/i, window: 1_000_000 },
  { match: /deepseek.*(v3|r1|reasoner)|deepseek-chat/i, window: 128_000 },
  { match: /deepseek/i, window: 64_000 },
  { match: /qwen.*(max|plus|turbo|2\.5|3)|qwen2|qwen3/i, window: 128_000 },
  { match: /qwen/i, window: 32_768 },
  { match: /(kimi|moonshot)/i, window: 128_000 },
  { match: /(glm|chatglm)/i, window: 128_000 },
  { match: /(yi|01-ai)/i, window: 200_000 },
  { match: /(llama-3|llama3)/i, window: 128_000 },
  { match: /mistral|mixtral/i, window: 32_768 }
]

/** 估算模型上下文窗口（token）；未知返回默认值；override 优先 */
export function getModelContextWindow(
  modelId?: string | null,
  overrideWindow?: number | null
): number {
  if (overrideWindow != null && overrideWindow > 0) return overrideWindow
  if (!modelId) return DEFAULT_MODEL_CONTEXT_WINDOW
  for (const entry of MODEL_CONTEXT_WINDOW_TABLE) {
    if (entry.match.test(modelId)) return entry.window
  }
  return DEFAULT_MODEL_CONTEXT_WINDOW
}
