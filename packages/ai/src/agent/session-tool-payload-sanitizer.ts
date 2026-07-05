import {
  TOOL_PAYLOAD_PREVIEW_CHARS,
  TOOL_PAYLOAD_PRUNE_FIELD_MAX_BYTES,
  TOOL_PAYLOAD_STORE_MAX_BYTES
} from './compression.constants'

export type ToolPartData = {
  callId?: string
  name?: string
  arguments?: unknown
  result?: unknown
  status?: string
  contentPreview?: string
  contentLength?: number
  contentPruned?: boolean
  resultPreview?: string
  resultLength?: number
  resultPruned?: boolean
  resultDates?: string[]
  argumentsPruned?: boolean
}

const DATE_HEADER_RE = /(?:^|\n)## (\d{4}-\d{2}-\d{2})/g

function parseArguments(args: unknown): Record<string, unknown> | null {
  if (args == null) return null
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args) as unknown
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof args === 'object') return args as Record<string, unknown>
  return null
}

function stringifyPayloadValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function stringByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function buildPreview(text: string): string {
  if (text.length <= TOOL_PAYLOAD_PREVIEW_CHARS) return text
  return `${text.slice(0, TOOL_PAYLOAD_PREVIEW_CHARS)}…`
}

function extractDiaryDates(text: string): string[] {
  const dates = new Set<string>()
  for (const match of text.matchAll(DATE_HEADER_RE)) {
    const date = match[1]
    if (date) dates.add(date)
  }
  return [...dates]
}

function slimLargeStringFields(
  source: Record<string, unknown>,
  fieldMaxBytes: number
): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  let changed = false

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && stringByteLength(value) > fieldMaxBytes) {
      next[`${key}Preview`] = buildPreview(value)
      next[`${key}Length`] = value.length
      changed = true
      continue
    }
    next[key] = value
  }

  if (changed) {
    next.argumentsPruned = true
  }
  return next
}

function sanitizeDiaryWriteEditPayload(
  data: ToolPartData,
  fieldMaxBytes: number = TOOL_PAYLOAD_PRUNE_FIELD_MAX_BYTES
): ToolPartData {
  const args = parseArguments(data.arguments)
  if (!args) return sanitizeGenericToolPayload(data, fieldMaxBytes)

  const content = typeof args.content === 'string' ? args.content : ''
  const { content: _removed, ...restArgs } = args

  return {
    ...data,
    arguments: {
      ...restArgs,
      contentPreview: buildPreview(content),
      contentLength: content.length,
      contentPruned: true
    }
  }
}

function sanitizeDiaryReadPayload(data: ToolPartData): ToolPartData {
  const resultText = stringifyPayloadValue(data.result)
  const dates = extractDiaryDates(resultText)

  return {
    ...data,
    result: `[已修剪：读取 ${dates.length > 0 ? dates.length : '若干'} 篇日记，正文见日记文件]`,
    resultPreview: buildPreview(resultText),
    resultLength: resultText.length,
    resultDates: dates.length > 0 ? dates : undefined,
    resultPruned: true
  }
}

function sanitizeGenericToolPayload(
  data: ToolPartData,
  fieldMaxBytes: number = TOOL_PAYLOAD_PRUNE_FIELD_MAX_BYTES
): ToolPartData {
  const next: ToolPartData = { ...data }
  let changed = false

  const args = parseArguments(data.arguments)
  const argsText = stringifyPayloadValue(data.arguments)
  if (args && argsText && stringByteLength(argsText) > fieldMaxBytes) {
    next.arguments = slimLargeStringFields(args, fieldMaxBytes)
    changed = true
  } else if (!args && argsText && stringByteLength(argsText) > fieldMaxBytes) {
    next.arguments = {
      argumentsPreview: buildPreview(argsText),
      argumentsLength: argsText.length,
      argumentsPruned: true
    }
    changed = true
  }

  const resultText = stringifyPayloadValue(data.result)
  if (resultText && stringByteLength(resultText) > fieldMaxBytes) {
    next.result = `[内容已修剪，长度 ${resultText.length} 字]`
    next.resultPreview = buildPreview(resultText)
    next.resultLength = resultText.length
    next.resultPruned = true
    changed = true
  }

  return changed ? next : data
}

export function estimateToolPayloadSize(data: unknown): number {
  if (!data || typeof data !== 'object') return 0
  const d = data as ToolPartData
  let total = 0
  const argsText = stringifyPayloadValue(d.arguments)
  const resultText = stringifyPayloadValue(d.result)
  total += stringByteLength(argsText)
  total += stringByteLength(resultText)
  return total
}

export function isPrunedToolPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as ToolPartData
  if (d.contentPruned === true || d.resultPruned === true || d.argumentsPruned === true) {
    return true
  }
  const args = parseArguments(d.arguments)
  if (args?.contentPruned === true || args?.argumentsPruned === true) return true
  return false
}

/** 入库前瘦身：避免单轮批量 tool 调用把会话撑爆 */
export function sanitizeToolPayloadForStorage(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data

  const d = data as ToolPartData
  const name = typeof d.name === 'string' ? d.name : ''

  if (name === 'diary_write' || name === 'diary_edit') {
    return sanitizeDiaryWriteEditPayload(d)
  }

  // 入库默认保留完整 result；仅极端超大 payload 才兜底瘦身
  if (estimateToolPayloadSize(d) <= TOOL_PAYLOAD_STORE_MAX_BYTES) {
    return data
  }
  return sanitizeGenericToolPayload(d, TOOL_PAYLOAD_STORE_MAX_BYTES)
}

export function sanitizeToolPayloadForPrune(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  if (isPrunedToolPayload(data)) return data

  const d = data as ToolPartData
  const name = typeof d.name === 'string' ? d.name : ''

  if (name === 'diary_write' || name === 'diary_edit') {
    return sanitizeDiaryWriteEditPayload(d)
  }
  if (name === 'diary_read') {
    const resultText = stringifyPayloadValue(d.result)
    if (resultText && stringByteLength(resultText) > TOOL_PAYLOAD_PRUNE_FIELD_MAX_BYTES) {
      return sanitizeDiaryReadPayload(d)
    }
    return data
  }
  return sanitizeGenericToolPayload(d)
}
