import type { ToolInvocationLike } from './tool-result.types'

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

export function readToolSourceUrl(invocation: ToolInvocationLike): string | undefined {
  if (invocation.toolName !== 'url_read') return undefined
  const args = invocation.args
  if (!args || typeof args !== 'object') return undefined
  const url = (args as Record<string, unknown>).url
  return typeof url === 'string' && url.trim() ? url.trim() : undefined
}

export function shouldUseStructuredPresentation(data: unknown): boolean {
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

export function getToolResultRawContent(invocation: ToolInvocationLike): string {
  if (typeof invocation.result === 'string') return invocation.result
  const resultObj =
    typeof invocation.result === 'object' && invocation.result !== null
      ? invocation.result
      : { content: '' }
  return JSON.stringify(resultObj)
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
