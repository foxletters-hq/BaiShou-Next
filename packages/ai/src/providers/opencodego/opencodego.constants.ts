/** OpenCode Go API 默认根路径 @see https://opencode.ai/docs/go/ */
export const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

export {
  OPENCODE_GO_USER_AGENT,
  OPENCODE_GO_SESSION_HEADER,
  OPENCODE_GO_MODELS_SESSION_ID,
  OPENCODE_GO_CONNECTION_TEST_SESSION_ID
} from './opencodego.headers'

/**
 * 官方文档标注为 Anthropic Messages API（`/v1/messages`）的模型 ID。
 * @see https://opencode.ai/docs/go/#endpoints
 */
export const OPENCODE_GO_ANTHROPIC_WIRE_MODEL_IDS: ReadonlySet<string> = new Set([
  'claude-haiku-5-5',
  'minimax-m3',
  'minimax-m2.7',
  'qwen3.8-max',
  'qwen3.8-flash',
  'qwen3.7-plus'
])

/**
 * 官方文档标注为 OpenAI Responses API（`/v1/responses`）的模型 ID。
 * @see https://opencode.ai/docs/go/#endpoints
 */
export const OPENCODE_GO_RESPONSES_WIRE_MODEL_IDS: ReadonlySet<string> = new Set([
  'grok-4.7',
  'grok-4.6',
  'gpt-6-luna',
  'gpt-5.6-luna',
  'muse-spark-1.3-contributor',
  'muse-spark-1.2-contributor'
])

/** 无模型上下文时的默认对话模型 */
export const OPENCODE_GO_DEFAULT_DIALOGUE_MODEL = 'kimi-k2.7-code'
