import i18n from 'i18next'
import {
  isCompanionAskCancelledMessage,
  parseKnowledgeSearchToolResult,
  TOOL_EXECUTION_FAILED_PREFIX
} from '@baishou/shared'
import {
  isCompanionAskDeclineRaw,
  resolveCompanionAskPresentation
} from './tool-result-companion-ask.util'
import { formatToolCopy, localizeToolResultText } from './tool-result-localize.util'
import {
  getToolResultRawContent,
  normalizeToolResultPlainText,
  parseToolResultJson,
  readToolSourceUrl,
  shouldUseStructuredPresentation,
  unwrapPlainToolResultText
} from './tool-result-plain.util'
import { getToolInvocationSubtitle } from './tool-result-subtitle.util'
import { readInvocationToolName, truncateSubtitle } from './tool-result-args.util'
import type {
  ToolCopyTranslate,
  ToolInvocationLike,
  ToolResultPresentation
} from './tool-result.types'

export type {
  CompanionAskOptionView,
  CompanionAskPresentation,
  ToolCopyTranslate,
  ToolInvocationLike,
  ToolResultPresentation
} from './tool-result.types'
export { unwrapPlainToolResultText, normalizeToolResultPlainText } from './tool-result-plain.util'
export { getToolResultRawContent, parseToolResultJson } from './tool-result-plain.util'
export { resolveCompanionAskPresentation } from './tool-result-companion-ask.util'
export { localizeToolResultText } from './tool-result-localize.util'
export {
  getToolDisplayName,
  getToolInvocationSubtitle,
  resolveActiveToolDisplayName
} from './tool-result-subtitle.util'

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
  if (readInvocationToolName(invocation) === 'companion_ask' && isCompanionAskDeclineRaw(raw)) {
    return false
  }

  return (
    raw.startsWith('Error') ||
    raw.startsWith('Tool execution failed') ||
    raw.startsWith(TOOL_EXECUTION_FAILED_PREFIX) ||
    raw.startsWith('Failed to fetch URL:') ||
    raw.startsWith('Web search failed:')
  )
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
    return formatToolCopy(
      t,
      'agent.tools.execution_failed',
      i18n.t('auto.packages.ui.src.shared.tool.result.util.L541', '工具执行失败')
    )
  }
  if (invocation) {
    const parsed = resolveCompanionAskPresentation(invocation)
    if (parsed?.declined) {
      const raw =
        typeof invocation.result === 'string'
          ? invocation.result
          : getToolResultRawContent(invocation)
      const cancelled = isCompanionAskCancelledMessage(raw)
      return formatToolCopy(
        t,
        cancelled ? 'agent.tools.companion_ask_cancelled' : 'agent.tools.companion_ask_declined',
        cancelled
          ? i18n.t('auto.packages.ui.src.shared.tool.result.util.L546', '用户取消了这一次操作')
          : i18n.t('auto.packages.ui.src.shared.tool.result.util.L546', '没有作答')
      )
    }
  }
  return getToolInvocationSubtitle(invocation)
}
