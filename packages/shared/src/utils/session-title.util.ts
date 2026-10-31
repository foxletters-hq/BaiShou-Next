/** 未配置命名模型时，从用户首条消息截取标题的默认长度（对齐桌面 createSession） */
export const SESSION_TITLE_FROM_USER_TEXT_MAX_LENGTH = 10

/** 分支标题中附带的分叉点消息摘要最大长度 */
export const BRANCH_POINT_SNIPPET_MAX_LENGTH = 10

/**
 * 从用户发送内容推导会话标题（无命名模型时的回退策略）。
 */
export function deriveSessionTitleFromUserText(
  text: string,
  maxLength = SESSION_TITLE_FROM_USER_TEXT_MAX_LENGTH
): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.substring(0, maxLength)
}

function normalizeSingleLineText(raw: string, maxLength: number): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  if (collapsed.length <= maxLength) return collapsed
  return `${collapsed.slice(0, maxLength)}…`
}

/**
 * 从消息对象、parts 数组或纯文本中提取非推理的正文简短摘要。
 */
export function extractMessagePlainTextSnippet(
  messageOrParts: unknown,
  maxLength = BRANCH_POINT_SNIPPET_MAX_LENGTH
): string {
  if (!messageOrParts) return ''
  if (typeof messageOrParts === 'string') {
    return normalizeSingleLineText(messageOrParts, maxLength)
  }

  const parts: unknown[] = Array.isArray(messageOrParts)
    ? messageOrParts
    : Array.isArray((messageOrParts as { parts?: unknown[] }).parts)
      ? ((messageOrParts as { parts: unknown[] }).parts ?? [])
      : []

  const chunks: string[] = []
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const p = part as { type?: string; data?: unknown }
    if (p.type !== 'text') continue
    const data =
      typeof p.data === 'string'
        ? (() => {
            try {
              return JSON.parse(p.data) as { text?: string; isReasoning?: unknown }
            } catch {
              return { text: p.data }
            }
          })()
        : (p.data as { text?: string; isReasoning?: unknown } | null | undefined)
    if (!data) continue
    if (data.isReasoning === true || data.isReasoning === 1 || data.isReasoning === 'true') {
      continue
    }
    if (typeof data.text === 'string' && data.text.trim()) {
      chunks.push(data.text.trim())
    }
  }

  if (chunks.length > 0) {
    return normalizeSingleLineText(chunks.join(' '), maxLength)
  }

  const directContent = (messageOrParts as { content?: unknown }).content
  if (typeof directContent === 'string') {
    return normalizeSingleLineText(directContent, maxLength)
  }

  return ''
}

const TRAILING_BRANCH_SUFFIX_RE =
  /(?:\s*[(（](?:分支|从此处创建分支|從此處建立分支|Branch|ここから分岐)(?:[·:：][^)）]*)?[)）])+$/i

/**
 * 生成具有区分度的对话分支标题：
 * 1. 优先保留原会话标题（并剥离末尾已有的分支标记，避免无限叠加）；
 * 2. 若提供分叉点消息内容，附带简短摘要以便在列表与搜索中区分不同分支。
 */
export function buildBranchSessionTitle(options: {
  originalTitle?: string | null
  assistantName?: string | null
  branchPointText?: string | null
  branchPointSnippet?: string | null
  defaultTitle?: string
  branchLabel?: string
}): string {
  const rawOriginal = options.originalTitle?.trim() || ''
  const strippedOriginal = rawOriginal.replace(TRAILING_BRANCH_SUFFIX_RE, '').trim()
  const baseTitle =
    strippedOriginal ||
    rawOriginal ||
    options.assistantName?.trim() ||
    options.defaultTitle?.trim() ||
    '新对话'

  const rawLabel = options.branchLabel?.trim() || '分支'
  // 若传入的 i18n 文案是按钮提示“从此处创建分支”，在标题后缀中收敛为简短的“分支”以留出空间给分叉点摘要
  const compactLabel =
    rawLabel === '从此处创建分支' || rawLabel === '從此處建立分支' ? '分支' : rawLabel

  const snippet = extractMessagePlainTextSnippet(
    options.branchPointText ?? options.branchPointSnippet ?? '',
    BRANCH_POINT_SNIPPET_MAX_LENGTH
  )

  return snippet ? `${baseTitle} (${compactLabel}·${snippet})` : `${baseTitle} (${compactLabel})`
}
