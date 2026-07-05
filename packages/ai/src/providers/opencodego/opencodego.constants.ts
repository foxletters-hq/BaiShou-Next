/** OpenCode Go API 默认根路径 @see https://opencode.ai/docs/go/ */
export const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

/**
 * 官方文档标注为 Anthropic Messages API（`/v1/messages`）的模型 ID。
 * 其余模型走 OpenAI Chat Completions（`/v1/chat/completions`）。
 */
export const OPENCODE_GO_ANTHROPIC_WIRE_MODEL_IDS: ReadonlySet<string> = new Set([
  'minimax-m3',
  'minimax-m2.7',
  'minimax-m2.5',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.6-plus'
])

/** 无模型上下文时的默认对话模型 */
export const OPENCODE_GO_DEFAULT_DIALOGUE_MODEL = 'kimi-k2.7-code'
