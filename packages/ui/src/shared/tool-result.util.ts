import { parseKnowledgeSearchToolResult } from '@baishou/shared'

/** 工具调用结果解析 — web / native 共用 */

export interface ToolInvocationLike {
  toolCallId?: string
  toolName?: string
  result?: unknown
  args?: unknown
}

export type CompanionAskOptionView = {
  id: string
  label: string
}

export type CompanionAskPresentation = {
  mode: 'companion_ask'
  question: string
  answer: string | null
  declined: boolean
  options: CompanionAskOptionView[]
  selectedOptionIds: string[]
}

export type ToolResultPresentation =
  | { mode: 'plain'; text: string; renderAsMarkdown: boolean; sourceUrl?: string }
  | { mode: 'structured'; data: unknown }
  | { mode: 'error'; text: string }
  | CompanionAskPresentation

const COMPANION_ASK_DECLINED = /^User declined to answer\.?$/i

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

function readCompanionAskOptions(args: Record<string, unknown> | null): CompanionAskOptionView[] {
  if (!args || !Array.isArray(args.options)) return []
  return args.options
    .map((label, index) => ({
      id: String(index),
      label: typeof label === 'string' ? label.trim() : ''
    }))
    .filter((option) => option.label.length > 0)
}

function readCompanionAskResultObject(obj: Record<string, unknown>): {
  question?: string
  answer: string | null
  selectedOptionIds: string[]
} {
  const answer =
    typeof obj.answer === 'string' && obj.answer.trim() ? obj.answer.trim() : null
  const selectedOptionIds = Array.isArray(obj.selectedOptionIds)
    ? obj.selectedOptionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  return {
    question: readArgString(obj.question),
    answer,
    selectedOptionIds
  }
}

function parseCompanionAskResultPayload(result: unknown): {
  question?: string
  answer: string | null
  selectedOptionIds: string[]
  declined: boolean
} | null {
  if (result == null) {
    return { answer: null, selectedOptionIds: [], declined: false }
  }

  if (typeof result === 'string') {
    const trimmed = result.trim()
    if (!trimmed) return { answer: null, selectedOptionIds: [], declined: false }
    if (COMPANION_ASK_DECLINED.test(trimmed)) {
      return { answer: null, selectedOptionIds: [], declined: true }
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...readCompanionAskResultObject(parsed as Record<string, unknown>),
          declined: false
        }
      }
    } catch {
      // 门禁纠正时会直接返回用户自定义文本
    }
    return { answer: trimmed, selectedOptionIds: [], declined: false }
  }

  if (typeof result === 'object' && !Array.isArray(result)) {
    return {
      ...readCompanionAskResultObject(result as Record<string, unknown>),
      declined: false
    }
  }

  return null
}

/** 把 companion_ask 的工具结果收成问题 / 选项 / 已选答案，不把底层 JSON 交给界面 */
export function resolveCompanionAskPresentation(
  invocation: ToolInvocationLike
): CompanionAskPresentation | null {
  if (readInvocationToolName(invocation) !== 'companion_ask') return null

  const args = readArgsRecord(invocation.args)
  const options = readCompanionAskOptions(args)
  const fromArgsQuestion = args ? readArgString(args.question) : undefined
  const fromResult = parseCompanionAskResultPayload(invocation.result)
  if (!fromResult && !fromArgsQuestion && options.length === 0) return null

  const question = fromResult?.question ?? fromArgsQuestion ?? ''
  const declined = fromResult?.declined ?? false
  const selectedOptionIds = fromResult?.selectedOptionIds ?? []
  let answer = declined ? null : (fromResult?.answer ?? null)

  if (!answer && selectedOptionIds.length > 0) {
    const matched = options.find((option) => option.id === selectedOptionIds[0])
    if (matched) answer = matched.label
  }

  const displayOptions = [...options]
  if (answer && !displayOptions.some((option) => option.label === answer)) {
    displayOptions.push({
      id: selectedOptionIds[0] ?? 'custom',
      label: answer
    })
  }

  if (!question && !answer && !declined && displayOptions.length === 0) return null

  const resolvedSelectedIds =
    selectedOptionIds.length > 0
      ? selectedOptionIds
      : answer
        ? [displayOptions.find((option) => option.label === answer)?.id ?? 'custom']
        : []

  return {
    mode: 'companion_ask',
    question,
    answer,
    declined,
    options: displayOptions,
    selectedOptionIds: resolvedSelectedIds
  }
}

export function resolveToolResultPresentation(
  invocation: ToolInvocationLike
): ToolResultPresentation {
  const isError = isToolResultError(invocation)
  if (!isError) {
    const companionAsk = resolveCompanionAskPresentation(invocation)
    if (companionAsk) return companionAsk
    const knowledgeSearch = parseKnowledgeSearchToolResult(invocation.result)
    if (knowledgeSearch && invocation.toolName === 'knowledge_search') {
      return {
        mode: 'plain',
        text: normalizeToolResultPlainText(knowledgeSearch.text),
        renderAsMarkdown: true
      }
    }
  }
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

const MCP_TOOL_PREFIX = /^mcp__[^_]+__/
const PATH_ARG_KEYS = ['path', 'filePath', 'file', 'target'] as const
const TEXT_ARG_KEYS = ['query', 'pattern', 'url', 'command', 'description'] as const
const SUBTITLE_MAX_CHARS = 56

function stripMcpToolPrefix(name: string): string {
  return name.replace(MCP_TOOL_PREFIX, '')
}

function readInvocationToolName(invocation: ToolInvocationLike): string | undefined {
  const raw = invocation.toolName || (invocation as { name?: string }).name
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return stripMcpToolPrefix(raw.trim())
}

function readArgsRecord(args: unknown): Record<string, unknown> | null {
  if (args == null) return null
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  return null
}

function readArgString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function fileNameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] || value
}

function truncateSubtitle(value: string): string {
  if (value.length <= SUBTITLE_MAX_CHARS) return value
  return `${value.slice(0, SUBTITLE_MAX_CHARS - 1)}…`
}

function formatPathishSubtitle(value: string): string {
  if (/^https?:\/\//i.test(value)) return truncateSubtitle(value)
  return truncateSubtitle(fileNameFromPath(value))
}

/** 折叠行副标题：文件名、查询词、命令等，避免默认展开整段结果 */
export function getToolInvocationSubtitle(invocation?: ToolInvocationLike): string | undefined {
  if (!invocation) return undefined
  const args = readArgsRecord(invocation.args)
  if (!args) return undefined

  const toolName = readInvocationToolName(invocation)
  if (toolName === 'companion_ask') {
    const parsed = resolveCompanionAskPresentation(invocation)
    if (parsed?.answer) return truncateSubtitle(parsed.answer)
    if (parsed?.question) return truncateSubtitle(parsed.question)
    const question = readArgString(args.question)
    if (question) return truncateSubtitle(question)
  }
  if (toolName === 'workspace_rename') {
    const from = readArgString(args.from ?? args.path ?? args.oldPath)
    const to = readArgString(args.to ?? args.newPath ?? args.target)
    if (from && to) {
      return `${fileNameFromPath(from)} → ${fileNameFromPath(to)}`
    }
  }
  if (toolName === 'skill_write') {
    const name = readArgString(args.name)
    if (name) return truncateSubtitle(name)
  }

  for (const key of PATH_ARG_KEYS) {
    const value = readArgString(args[key])
    if (value) return formatPathishSubtitle(value)
  }
  for (const key of TEXT_ARG_KEYS) {
    const value = readArgString(args[key])
    if (value) return key === 'url' ? formatPathishSubtitle(value) : truncateSubtitle(value)
  }
  return undefined
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
    const engineLabel = engineKey ? t(engineKey, webSearchEngine) : webSearchEngine
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
    raw.startsWith('Tool execution failed') ||
    raw.startsWith('Failed to fetch URL:') ||
    raw.startsWith('Web search failed:')
  )
}

export type ToolCopyTranslate = (
  key: string,
  fallbackOrOptions?: string | { defaultValue?: string; [key: string]: unknown }
) => unknown

function interpolateToolCopy(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => vars[name] ?? '')
}

function formatToolCopy(
  t: ToolCopyTranslate,
  key: string,
  defaultValue: string,
  vars?: Record<string, string>
): string {
  const raw = t(key, vars ? { defaultValue, ...vars } : { defaultValue })
  const text = typeof raw === 'string' && raw.trim() ? raw.trim() : defaultValue
  const template = text === key || text.startsWith('agent.tools.') ? defaultValue : text
  return interpolateToolCopy(template, vars)
}

function localizeToolResultLine(
  line: string,
  t: ToolCopyTranslate,
  options: { skillSave: boolean }
): string {
  const trimmed = line.trimEnd()
  if (!trimmed) return line

  if (COMPANION_ASK_DECLINED.test(trimmed)) {
    return formatToolCopy(t, 'agent.tools.companion_ask_declined', '没有作答')
  }

  if (/^Tool execution failed\.?$/.test(trimmed)) {
    return formatToolCopy(t, 'agent.tools.execution_failed', '工具执行失败')
  }

  const execFail = /^Tool execution failed:\s*(.*)$/.exec(trimmed)
  if (execFail) {
    const detail = execFail[1].trim()
    if (!detail) return formatToolCopy(t, 'agent.tools.execution_failed', '工具执行失败')
    return formatToolCopy(t, 'agent.tools.execution_failed_with_detail', '工具执行失败：{{detail}}', {
      detail
    })
  }

  if (/^Error:\s*Skill writer is not available in this environment\.?$/.test(trimmed)) {
    return formatToolCopy(t, 'agent.tools.skill_writer_unavailable', '当前环境无法写入技能')
  }

  const skillFail = /^Error:\s*Failed to save skill:\s*(.*)$/.exec(trimmed)
  if (skillFail) {
    return formatToolCopy(t, 'agent.tools.skill_write_failed', '未能保存技能：{{detail}}', {
      detail: skillFail[1].trim()
    })
  }

  const fetchFail = /^Failed to fetch URL:\s*(.*)$/.exec(trimmed)
  if (fetchFail) {
    return formatToolCopy(t, 'agent.tools.fetch_url_failed', '读取网页失败：{{detail}}', {
      detail: fetchFail[1].trim()
    })
  }

  const searchFail = /^Web search failed:\s*(.*)$/.exec(trimmed)
  if (searchFail) {
    return formatToolCopy(t, 'agent.tools.web_search_failed', '网络搜索失败：{{detail}}', {
      detail: searchFail[1].trim()
    })
  }

  const genericError = /^Error:\s*(.*)$/.exec(trimmed)
  if (genericError) {
    const detail = genericError[1].trim()
    if (!detail) return formatToolCopy(t, 'agent.tools.execution_failed', '工具执行失败')
    return formatToolCopy(t, 'agent.tools.error_with_detail', '出错：{{detail}}', { detail })
  }

  if (options.skillSave) {
    const saved = /^Saved skill "([^"]+)"\.$/.exec(trimmed)
    if (saved) {
      return formatToolCopy(t, 'agent.tools.skill_saved', '已保存技能「{{name}}」。', {
        name: saved[1]
      })
    }
    const loc = /^Location:\s*(.*)$/.exec(trimmed)
    if (loc) {
      return formatToolCopy(t, 'agent.tools.skill_saved_location', '位置：{{detail}}', {
        detail: loc[1]
      })
    }
    const desc = /^Description:\s*(.*)$/.exec(trimmed)
    if (desc) {
      return formatToolCopy(t, 'agent.tools.skill_saved_description', '说明：{{detail}}', {
        detail: desc[1]
      })
    }
  }

  return line
}

/** 将工具结果中的固定英文前缀译成当前界面语言；检测逻辑仍认英文原文 */
export function localizeToolResultText(text: string, t: ToolCopyTranslate): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const skillSave = /^Saved skill "/.test(lines[0]?.trim() ?? '')
  return lines.map((line) => localizeToolResultLine(line, t, { skillSave })).join('\n')
}

export function getToolRowSubtitle(
  invocation: ToolInvocationLike | undefined,
  status: 'loading' | 'success' | 'error',
  t: ToolCopyTranslate
): string | undefined {
  if (status === 'error' && invocation) {
    const presentation = resolveToolResultPresentation(invocation)
    if (presentation.mode === 'error') {
      const first = localizeToolResultText(presentation.text, t).split('\n')[0]?.trim()
      if (first) return truncateSubtitle(first)
    }
    return formatToolCopy(t, 'agent.tools.execution_failed', '工具执行失败')
  }
  if (invocation) {
    const parsed = resolveCompanionAskPresentation(invocation)
    if (parsed?.declined) {
      return formatToolCopy(t, 'agent.tools.companion_ask_declined', '没有作答')
    }
  }
  return getToolInvocationSubtitle(invocation)
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
