import type {
  DeepSeekExportFileMeta,
  DeepSeekFragment,
  DeepSeekImportSessionAggregate,
  DeepSeekRawMessage,
  DeepSeekSessionFile
} from './deepseek-import.types'

const MAX_SEARCH_RESULTS_STORED = 12
const MAX_IMAGE_SEARCH_RESULTS_STORED = 10
const MAX_READ_LINK_RESULTS_STORED = 12
const MAX_SNIPPET_LENGTH = 240
const MAX_FILE_NOTE_COUNT = 20

const SKIPPED_FRAGMENT_TYPES = new Set(['CONTENT_RISK', 'TIP', 'PARTIAL_FILE_READ'])

export interface ResolvedDeepSeekImageAttachment {
  name: string
  fileName: string
  filePath: string
  relativePath: string
  mimeType: string
  size?: number
}

function fnv1a32Hex(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function isSafeDeepSeekSessionId(id: string): boolean {
  if (typeof id !== 'string') return false
  const trimmed = id.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') return false
  return !/[/\\:\0]/.test(trimmed)
}

export function isSafeDeepSeekExportFilePath(sessionId: string, exportPath: string): boolean {
  if (!isSafeDeepSeekSessionId(sessionId)) return false
  if (typeof exportPath !== 'string' || !exportPath) return false
  const normalized = exportPath.normalize('NFC')
  if (normalized.includes('\\') || normalized.includes('\0') || /^[A-Za-z]:/.test(normalized)) {
    return false
  }
  const expectedPrefix = `chat_sessions/${sessionId}_files/`
  if (!normalized.startsWith(expectedPrefix)) return false
  const segments = normalized.split('/')
  return segments.every((seg) => Boolean(seg) && seg !== '.' && seg !== '..')
}

/**
 * 为导入到指定伙伴的 DeepSeek 会话生成确定性 ID。
 * 同一源会话重复导入到同一伙伴时自动去重；导入到不同伙伴时不互相覆盖。
 */
export function buildDeepSeekImportedSessionId(
  assistantId: string,
  sourceSessionId: string
): string {
  const safeSource = sourceSessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  const scopeHash = fnv1a32Hex(`${assistantId}::${sourceSessionId}`)
  return `ds_${scopeHash}_${safeSource}`
}

export function toValidDeepSeekDate(value: unknown, fallback?: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value < 1e12 ? value * 1000 : value)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return fallback ? new Date(fallback.getTime()) : new Date()
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

function sanitizeHttpUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return ''
}

function mapDeepSeekToolStatus(status?: string): 'completed' | 'failed' {
  if (status === 'FAILED') return 'failed'
  return 'completed'
}

/**
 * 从 DeepSeek 消息树中沿 `current_message_id -> parent_id` 回溯出当前主对话链。
 * 若 `current_message_id` 缺失或断链，回退按叶节点或 `inserted_at` / `id` 升序排列。
 */
export function extractMainMessageChain(
  messages: ReadonlyArray<DeepSeekRawMessage>,
  currentMessageId?: number | null
): DeepSeekRawMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) return []

  const byId = new Map<number, DeepSeekRawMessage>()
  for (const msg of messages) {
    if (msg && typeof msg.id === 'number') {
      byId.set(msg.id, msg)
    }
  }

  let cursor: DeepSeekRawMessage | undefined =
    typeof currentMessageId === 'number' ? byId.get(currentMessageId) : undefined

  if (!cursor) {
    const parentIds = new Set<number>()
    for (const msg of byId.values()) {
      if (typeof msg.parent_id === 'number') parentIds.add(msg.parent_id)
    }
    const leaves = [...byId.values()].filter((m) => !parentIds.has(m.id))
    leaves.sort((a, b) => a.id - b.id)
    cursor = leaves[leaves.length - 1]
  }

  if (cursor) {
    const chain: DeepSeekRawMessage[] = []
    const visited = new Set<number>()
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      chain.push(cursor)
      cursor = cursor.parent_id != null ? byId.get(cursor.parent_id) : undefined
    }
    if (chain.length > 0) {
      return chain.reverse()
    }
  }

  return [...messages].sort((a, b) => {
    const ta = toValidDeepSeekDate(a.inserted_at).getTime()
    const tb = toValidDeepSeekDate(b.inserted_at).getTime()
    if (ta !== tb) return ta - tb
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

function buildCompactToolPart(params: {
  fragment: DeepSeekFragment
  messageId: string
  sessionId: string
  seq: number
  createdAt: Date
}): DeepSeekImportSessionAggregate['messages'][number]['parts'][number] | null {
  const { fragment, messageId, sessionId, seq, createdAt } = params
  const callId = `ds_tool_${messageId}_${seq}`

  if (fragment.type === 'TOOL_SEARCH') {
    const queries = Array.isArray(fragment.queries)
      ? fragment.queries.filter((q): q is string => typeof q === 'string' && Boolean(q.trim()))
      : []
    const rawResults = Array.isArray(fragment.results) ? fragment.results : []
    const compactResults = rawResults
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_SEARCH_RESULTS_STORED)
      .map((item) => ({
        title: truncateText(item.title, 160),
        url: sanitizeHttpUrl(item.url),
        snippet: truncateText(item.snippet, MAX_SNIPPET_LENGTH),
        ...(item.site_name ? { siteName: truncateText(item.site_name, 80) } : {}),
        ...(item.published_at ? { publishedAt: item.published_at } : {})
      }))
    return {
      id: `${messageId}_p_${seq}`,
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId,
        name: 'web_search',
        status: mapDeepSeekToolStatus(
          typeof fragment.status === 'string' ? fragment.status : undefined
        ),
        arguments: {
          query: queries[0] ?? '',
          queries
        },
        result: JSON.stringify({
          totalCount: rawResults.length,
          results: compactResults
        }),
        seq
      },
      createdAt
    }
  }

  if (fragment.type === 'TOOL_OPEN') {
    const url = sanitizeHttpUrl(fragment.url)
    if (!url) return null
    return {
      id: `${messageId}_p_${seq}`,
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId,
        name: 'web_fetch',
        status: mapDeepSeekToolStatus(
          typeof fragment.status === 'string' ? fragment.status : undefined
        ),
        arguments: { url },
        result: JSON.stringify({
          url,
          title: truncateText(typeof fragment.title === 'string' ? fragment.title : '', 160),
          ...(typeof fragment.snippet === 'string' && fragment.snippet
            ? { snippet: truncateText(fragment.snippet, MAX_SNIPPET_LENGTH) }
            : {}),
          ...(typeof fragment.site_name === 'string' && fragment.site_name
            ? { siteName: truncateText(fragment.site_name, 80) }
            : {})
        }),
        seq
      },
      createdAt
    }
  }

  if (fragment.type === 'TOOL_FIND') {
    const pattern = typeof fragment.pattern === 'string' ? fragment.pattern : ''
    return {
      id: `${messageId}_p_${seq}`,
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId,
        name: 'find_in_page',
        status: mapDeepSeekToolStatus(
          typeof fragment.status === 'string' ? fragment.status : undefined
        ),
        arguments: { pattern },
        result: JSON.stringify({
          status: typeof fragment.status === 'string' ? fragment.status : 'FINISHED'
        }),
        seq
      },
      createdAt
    }
  }

  if (fragment.type === 'READ_LINK') {
    const rawLinks = Array.isArray(fragment.results) ? fragment.results : []
    const links = rawLinks
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_READ_LINK_RESULTS_STORED)
      .map((item) => ({
        url: sanitizeHttpUrl(item.url),
        title: truncateText(item.title, 160),
        ...(item.signature ? { signature: item.signature } : {})
      }))
      .filter((item) => Boolean(item.url || item.title))
    if (links.length === 0) return null
    return {
      id: `${messageId}_p_${seq}`,
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId,
        name: 'read_link',
        status: 'completed',
        arguments: {
          urls: links.map((l) => l.url).filter(Boolean)
        },
        result: JSON.stringify({ results: links }),
        seq
      },
      createdAt
    }
  }

  if (fragment.type === 'TOOL_IMAGE_SEARCH') {
    const rawResults = Array.isArray(fragment.results) ? fragment.results : []
    const compactResults = rawResults
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_IMAGE_SEARCH_RESULTS_STORED)
      .map((item) => ({
        title: truncateText(item.title, 160),
        url: sanitizeHttpUrl(item.source_page_url),
        snippet: truncateText(item.snippet, MAX_SNIPPET_LENGTH),
        ...(item.site_name ? { siteName: truncateText(item.site_name, 80) } : {})
      }))
    return {
      id: `${messageId}_p_${seq}`,
      messageId,
      sessionId,
      type: 'tool',
      data: {
        callId,
        name: 'image_search',
        status: mapDeepSeekToolStatus(
          typeof fragment.status === 'string' ? fragment.status : undefined
        ),
        arguments: {},
        result: JSON.stringify({
          totalCount: rawResults.length,
          results: compactResults
        }),
        seq
      },
      createdAt
    }
  }

  return null
}

/**
 * 将单条 DeepSeek 会话转换为白守 `SessionAggregate`（可直接写入 SQLite 并落盘为 Sessions JSON）。
 */
export async function buildSessionAggregateFromDeepSeek(options: {
  sourceSession: DeepSeekSessionFile
  targetSessionId: string
  assistantId: string
  vaultId: string
  vaultName: string
  fallbackTitle?: string
  resolveImageAttachment?: (
    file: DeepSeekExportFileMeta
  ) => Promise<ResolvedDeepSeekImageAttachment | null>
}): Promise<{
  aggregate: DeepSeekImportSessionAggregate
  importedAttachments: number
}> {
  const {
    sourceSession,
    targetSessionId,
    assistantId,
    vaultId,
    vaultName,
    fallbackTitle,
    resolveImageAttachment
  } = options

  const createdAt = toValidDeepSeekDate(sourceSession.inserted_at)
  const updatedAt = toValidDeepSeekDate(
    sourceSession.updated_at ?? sourceSession.inserted_at,
    createdAt
  )
  const rawMessages = Array.isArray(sourceSession.messages) ? sourceSession.messages : []
  const activeChain = extractMainMessageChain(rawMessages, sourceSession.current_message_id)

  const messages: DeepSeekImportSessionAggregate['messages'] = []
  let importedAttachments = 0
  let orderIndex = 0

  for (const rawMsg of activeChain) {
    const roleUpper = String(rawMsg.role ?? '').toUpperCase()
    const role: 'user' | 'assistant' = roleUpper === 'ASSISTANT' ? 'assistant' : 'user'
    const msgCreatedAt = toValidDeepSeekDate(rawMsg.inserted_at, createdAt)
    const messageId = `${targetSessionId}_m_${rawMsg.id ?? orderIndex + 1}`
    const fragments = Array.isArray(rawMsg.fragments) ? rawMsg.fragments : []
    const isContentFilter = role === 'assistant' && rawMsg.status === 'CONTENT_FILTER'

    const parts: DeepSeekImportSessionAggregate['messages'][number]['parts'] = []
    let seq = 0
    const nonImageFileLabels: string[] = []

    for (const frag of fragments) {
      if (!frag || typeof frag !== 'object' || typeof frag.type !== 'string') continue
      if (SKIPPED_FRAGMENT_TYPES.has(frag.type)) continue

      if (role === 'user') {
        if (frag.type === 'REQUEST') {
          const text = typeof frag.content === 'string' ? frag.content : ''
          if (text.trim()) {
            parts.push({
              id: `${messageId}_p_${seq}`,
              messageId,
              sessionId: targetSessionId,
              type: 'text',
              data: { text, seq },
              createdAt: msgCreatedAt
            })
            seq += 1
          }
        } else if (frag.type === 'FILE' && Array.isArray(frag.files)) {
          for (const file of frag.files) {
            if (!file || typeof file !== 'object') continue
            if (file.is_image && file.export_path && resolveImageAttachment) {
              const resolved = await resolveImageAttachment(file)
              if (resolved) {
                parts.push({
                  id: `${messageId}_p_${seq}`,
                  messageId,
                  sessionId: targetSessionId,
                  type: 'attachment',
                  data: {
                    type: 'image',
                    isImage: true,
                    name: resolved.name,
                    fileName: resolved.fileName,
                    filePath: resolved.filePath,
                    url: resolved.filePath,
                    relativePath: resolved.relativePath,
                    mimeType: resolved.mimeType,
                    ...(typeof resolved.size === 'number' ? { size: resolved.size } : {}),
                    seq
                  },
                  createdAt: msgCreatedAt
                })
                seq += 1
                importedAttachments += 1
                continue
              }
            }
            if (
              typeof file.file_name === 'string' &&
              file.file_name.trim() &&
              nonImageFileLabels.length < MAX_FILE_NOTE_COUNT
            ) {
              nonImageFileLabels.push(`[${file.file_name.trim()}]`)
            }
          }
        }
        continue
      }

      if (frag.type === 'THINK') {
        if (isContentFilter) continue
        const text = typeof frag.content === 'string' ? frag.content : ''
        if (text.trim()) {
          parts.push({
            id: `${messageId}_p_${seq}`,
            messageId,
            sessionId: targetSessionId,
            type: 'text',
            data: {
              text,
              isReasoning: true,
              ...(typeof frag.elapsed_secs === 'number' && Number.isFinite(frag.elapsed_secs)
                ? { elapsedSecs: frag.elapsed_secs }
                : {}),
              seq
            },
            createdAt: msgCreatedAt
          })
          seq += 1
        }
        continue
      }

      if (frag.type === 'RESPONSE') {
        if (isContentFilter) continue
        const text = typeof frag.content === 'string' ? frag.content : ''
        if (text.trim()) {
          parts.push({
            id: `${messageId}_p_${seq}`,
            messageId,
            sessionId: targetSessionId,
            type: 'text',
            data: { text, seq },
            createdAt: msgCreatedAt
          })
          seq += 1
        }
        continue
      }

      if (frag.type === 'TEMPLATE_RESPONSE') {
        const text = typeof frag.content === 'string' ? frag.content : ''
        if (text.trim()) {
          parts.push({
            id: `${messageId}_p_${seq}`,
            messageId,
            sessionId: targetSessionId,
            type: 'text',
            data: { text, seq },
            createdAt: msgCreatedAt
          })
          seq += 1
        }
        continue
      }

      const toolPart = buildCompactToolPart({
        fragment: frag,
        messageId,
        sessionId: targetSessionId,
        seq,
        createdAt: msgCreatedAt
      })
      if (toolPart) {
        parts.push(toolPart)
        seq += 1
      }
    }

    if (role === 'user' && nonImageFileLabels.length > 0) {
      const note = nonImageFileLabels.join(' ')
      const firstTextPart = parts.find((p) => p.type === 'text')
      if (firstTextPart && typeof firstTextPart.data.text === 'string') {
        firstTextPart.data.text = `${firstTextPart.data.text}\n\n${note}`
      } else {
        parts.push({
          id: `${messageId}_p_${seq}`,
          messageId,
          sessionId: targetSessionId,
          type: 'text',
          data: { text: note, seq },
          createdAt: msgCreatedAt
        })
      }
    }

    if (parts.length === 0) continue

    messages.push({
      id: messageId,
      sessionId: targetSessionId,
      role,
      isSummary: false,
      orderIndex,
      providerId: 'deepseek',
      createdAt: msgCreatedAt,
      parts
    })
    orderIndex += 1
  }

  const resolvedTitle =
    (typeof sourceSession.title === 'string' && sourceSession.title.trim()) ||
    fallbackTitle?.trim() ||
    null

  return {
    aggregate: {
      session: {
        id: targetSessionId,
        title: resolvedTitle,
        vaultId,
        vaultName,
        assistantId,
        isPinned: Boolean(sourceSession.pinned),
        providerId: 'deepseek',
        modelId: '',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadInputTokens: 0,
        totalCacheWriteInputTokens: 0,
        totalCostMicros: 0,
        createdAt,
        updatedAt
      },
      messages
    },
    importedAttachments
  }
}
