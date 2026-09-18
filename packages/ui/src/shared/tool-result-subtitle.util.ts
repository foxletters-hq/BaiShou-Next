import { resolveAgentToolActionLabel, type FallbackTranslateFn } from '@baishou/shared'
import {
  fileNameFromPath,
  formatPathishSubtitle,
  readArgString,
  readArgsRecord,
  readInvocationToolName,
  readRawInvocationToolName,
  truncateSubtitle
} from './tool-result-args.util'
import { resolveCompanionAskPresentation } from './tool-result-companion-ask.util'
import type { ToolInvocationLike } from './tool-result.types'

const PATH_ARG_KEYS = ['path', 'filePath', 'file', 'target'] as const
const TEXT_ARG_KEYS = ['query', 'pattern', 'url', 'command', 'description'] as const

const WEB_SEARCH_ENGINE_LABEL_KEYS: Record<string, string> = {
  'local-google': 'settings.web_search_engine_local_google',
  'local-bing': 'settings.web_search_engine_local_bing',
  duckduckgo: 'settings.web_search_engine_duckduckgo',
  tavily: 'settings.web_search_engine_tavily',
  'exa-mcp': 'settings.web_search_engine_exa_mcp',
  exa: 'settings.web_search_engine_exa',
  anysearch: 'settings.web_search_engine_anysearch'
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

/** 流式进行中的工具展示名（与桌面消息列表对齐） */
export function resolveActiveToolDisplayName(
  activeTool: { name: string } | null | undefined,
  t: FallbackTranslateFn,
  webSearchEngine = 'exa-mcp'
): string | null {
  if (!activeTool?.name) return null
  if (activeTool.name === 'web_search') {
    const engineKey = WEB_SEARCH_ENGINE_LABEL_KEYS[webSearchEngine]
    const engineLabel = engineKey ? t(engineKey, webSearchEngine) : webSearchEngine
    return `${t('agent.tools.web_search', '网络搜索')} (${engineLabel})`
  }
  return resolveAgentToolActionLabel(activeTool.name, t)
}

export function getToolDisplayName(invocation: ToolInvocationLike, t: FallbackTranslateFn): string {
  const rawName = readRawInvocationToolName(invocation)
  if (rawName) return resolveAgentToolActionLabel(rawName, t)
  const callId = invocation.toolCallId
  if (!callId) return t('agent.tools.tool_invocation', 'tool_invocation')
  return callId
}
