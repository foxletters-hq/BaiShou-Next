/** 工具调用结果解析 — web / native 共用 */

export interface ToolInvocationLike {
  toolCallId?: string
  toolName?: string
  result?: unknown
  args?: unknown
}

export type ToolResultPresentation =
  | { mode: 'plain'; text: string; renderAsMarkdown: boolean; sourceUrl?: string }
  | { mode: 'structured'; data: unknown }
  | { mode: 'error'; text: string }

const PLAIN_RESULT_KEYS = ['content', 'text', 'value', 'output', 'message'] as const

export function unwrapPlainToolResultText(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return null

  const obj = result as Record<string, unknown>
  if (obj.type === 'text' && typeof obj.value === 'string') return obj.value
  if (typeof obj.text === 'string' && Object.keys(obj).length === 1) return obj.text

  for (const key of PLAIN_RESULT_KEYS) {
    const value = obj[key]
    if (typeof value !== 'string') continue
    const keys = Object.keys(obj).filter((k) => k !== 'type' && k !== 'status')
    if (keys.length === 1) return value
  }

  return null
}

/** 展示用：去掉空行并压缩连续空白，避免网页正文撑出大段空白 */
export function normalizeToolResultPlainText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\t\f\v\u00a0]+/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim()
}

function readToolSourceUrl(invocation: ToolInvocationLike): string | undefined {
  if (invocation.toolName !== 'url_read') return undefined
  const args = invocation.args
  if (!args || typeof args !== 'object') return undefined
  const url = (args as Record<string, unknown>).url
  return typeof url === 'string' && url.trim() ? url.trim() : undefined
}

function shouldUseStructuredPresentation(data: unknown): boolean {
  if (Array.isArray(data)) return true
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>
  if (unwrapPlainToolResultText(data) != null) return false

  return (
    Array.isArray(obj.results) ||
    Array.isArray(obj.items) ||
    ('title' in obj && ('url' in obj || 'snippet' in obj || 'summary' in obj))
  )
}

export function resolveToolResultPresentation(invocation: ToolInvocationLike): ToolResultPresentation {
  const isError = isToolResultError(invocation)
  const plainText = unwrapPlainToolResultText(invocation.result)
  const sourceUrl = readToolSourceUrl(invocation)

  if (plainText != null) {
    return {
      mode: isError ? 'error' : 'plain',
      text: isError ? plainText : normalizeToolResultPlainText(plainText),
      renderAsMarkdown: !isError && invocation.toolName === 'url_read',
      sourceUrl
    }
  }

  const parsed = parseToolResultJson(invocation)
  if (parsed != null && !isError && shouldUseStructuredPresentation(parsed)) {
    return { mode: 'structured', data: parsed }
  }

  const raw = getToolResultRawContent(invocation)
  return {
    mode: isError ? 'error' : 'plain',
    text: isError ? raw : normalizeToolResultPlainText(raw),
    renderAsMarkdown: false,
    sourceUrl
  }
}

function readInvocationToolName(invocation: ToolInvocationLike): string | undefined {
  if (invocation.toolName) return invocation.toolName
  const legacyName = (invocation as { name?: string }).name
  return typeof legacyName === 'string' && legacyName.trim() ? legacyName.trim() : undefined
}

const WEB_SEARCH_ENGINE_LABEL_KEYS: Record<string, string> = {
  'local-google': 'settings.web_search_engine_local_google',
  'local-bing': 'settings.web_search_engine_local_bing',
  duckduckgo: 'settings.web_search_engine_duckduckgo',
  tavily: 'settings.web_search_engine_tavily',
  'exa-mcp': 'settings.web_search_engine_exa_mcp',
  exa: 'settings.web_search_engine_exa',
  anysearch: 'settings.web_search_engine_anysearch'
}

/** 流式进行中的工具展示名（与桌面 AgentMessageList 对齐） */
export function resolveActiveToolDisplayName(
  activeTool: { name: string } | null | undefined,
  t: (key: string, fallback?: string) => string,
  webSearchEngine = 'exa-mcp'
): string | null {
  if (!activeTool?.name) return null
  if (activeTool.name === 'web_search') {
    const engineKey = WEB_SEARCH_ENGINE_LABEL_KEYS[webSearchEngine]
    const engineLabel = engineKey
      ? t(engineKey, webSearchEngine)
      : webSearchEngine
    return `${t('agent.tools.web_search', '网络搜索')} (${engineLabel})`
  }
  return t(`agent.tools.${activeTool.name}`, activeTool.name)
}

export function getToolDisplayName(
  invocation: ToolInvocationLike,
  t: (key: string, fallback?: string) => string
): string {
  const rawName = readInvocationToolName(invocation)
  if (rawName) return t(`agent.tools.${rawName}`, rawName)
  const callId = invocation.toolCallId
  if (!callId) return t('agent.tools.tool_invocation', 'tool_invocation')
  return callId
}

export function getToolResultRawContent(invocation: ToolInvocationLike): string {
  if (typeof invocation.result === 'string') return invocation.result
  const resultObj =
    typeof invocation.result === 'object' && invocation.result !== null
      ? invocation.result
      : { content: '' }
  return JSON.stringify(resultObj)
}

export function isToolResultError(invocation: ToolInvocationLike): boolean {
  if (
    typeof invocation.result === 'object' &&
    invocation.result !== null &&
    'error' in (invocation.result as Record<string, unknown>)
  ) {
    return true
  }

  const raw =
    typeof invocation.result === 'string'
      ? invocation.result
      : typeof invocation.result === 'undefined' || invocation.result === null
        ? getToolResultRawContent(invocation)
        : null

  if (raw == null) return false

  return (
    raw.startsWith('Error') ||
    raw.startsWith('Tool execution failed:') ||
    raw.startsWith('Failed to fetch URL:') ||
    raw.startsWith('Web search failed:')
  )
}

export function parseToolResultJson(invocation: ToolInvocationLike): unknown | null {
  if (typeof invocation.result === 'object' && invocation.result !== null) {
    return invocation.result
  }
  const rawContent = getToolResultRawContent(invocation)
  try {
    return JSON.parse(rawContent)
  } catch {
    return null
  }
}
