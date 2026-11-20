export const PROVIDER_CONTENT_FILTER_ERROR_CODE = 'PROVIDER_CONTENT_FILTER'
export const PROVIDER_CONTENT_FILTER_I18N_KEY = 'agent.error.content_filter'
export const PROVIDER_CONTENT_FILTER_MESSAGE = '伙伴被服务商安全机制拦截了呀~不是白守的错哦'

const CONTENT_FILTER_FINISH_REASONS = new Set([
  'content-filter',
  'content_filter',
  'safety',
  'image_safety',
  'prohibited_content',
  'recitation',
  'blocklist',
  'spii',
  'refusal',
  'sensitive'
])

const CONTENT_FILTER_TEXT_PATTERNS: readonly RegExp[] = [
  /伙伴被服务商安全机制拦截/,
  /PROVIDER_CONTENT_FILTER/,
  /\bcontent[_\s-]?filter(?:ed|ing)?\b/i,
  /\bcontent[_\s-]?policy[_\s-]?violation\b/i,
  /\bprohibited[_\s-]?content\b/i,
  /\bimage[_\s-]?safety\b/i,
  /\bsensitive[_\s-]?content\b/i,
  /\bsensitivecontentdetected\b/i,
  /\bdatainspectionfailed\b/i,
  /\binappropriate\s+content\b/i,
  /\bpromptfeedback\b[\s\S]*\bblockreason\b/i,
  /\bblockreason\b[\s\S]*\b(?:safety|prohibited|blocklist|spii|other|recitation)\b/i,
  /\bblocked\s+(?:by|due\s+to)\b[\s\S]*\b(?:safety|content|moderation|policy|filter|prohibited|recitation)\b/i,
  /\brejected\s+(?:as\s+a\s+result\s+of|due\s+to|by)\b[\s\S]*\b(?:safety|content|moderation|policy)\b/i,
  /\b(?:output|response|request|prompt|message|generation|content)\b[\s\S]{0,40}\b(?:blocked|rejected|filtered|flagged)\b[\s\S]{0,60}\b(?:safety|policy|moderation|filter|recitation|prohibited|harm|sensitive|violation)\b/i,
  /\bviolat(?:e|es|ed|ing)\b[\s\S]{0,30}\b(?:safety|content|usage)\s+polic(?:y|ies)\b/i,
  /\bsafety\s+(?:system|filter|policy|mechanism|check)\b/i,
  /\bmoderation\s+(?:blocked|rejected|failed|policy)\b/i,
  /\bhigh[_\s-]?risk\b/i,
  /内容安全|安全机制拦截|安全审核|安全审查|安全策略拦截|内容审核|敏感内容|敏感词|违规内容|违禁内容|不合法内容|高风险内容|不当内容|不当信息|触发.*(?:安全|审核|过滤|拦截|风控)/
]

export interface ProviderContentFilterError extends Error {
  code: string
  rawDetail?: string
}

export function isContentFilterFinishReason(
  finishReason: unknown,
  rawFinishReason?: unknown
): boolean {
  const candidates = [finishReason, rawFinishReason]
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const normalized = value.trim().toLowerCase()
    if (normalized && CONTENT_FILTER_FINISH_REASONS.has(normalized)) {
      return true
    }
  }
  return false
}

export function createProviderContentFilterError(rawDetail?: string): ProviderContentFilterError {
  const error = new Error(PROVIDER_CONTENT_FILTER_MESSAGE) as ProviderContentFilterError
  error.name = 'ProviderContentFilterError'
  error.code = PROVIDER_CONTENT_FILTER_ERROR_CODE
  const trimmedDetail = typeof rawDetail === 'string' ? rawDetail.trim() : ''
  if (trimmedDetail) {
    error.rawDetail = trimmedDetail
  }
  return error
}

export function readProviderContentFilterDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const record = error as { rawDetail?: unknown; cause?: unknown }
  if (typeof record.rawDetail === 'string' && record.rawDetail.trim()) {
    return record.rawDetail.trim()
  }
  if (record.cause && record.cause !== error) {
    return readProviderContentFilterDetail(record.cause)
  }
  return undefined
}

function collectErrorTextParts(error: unknown, depth = 0, out: string[] = []): string[] {
  if (error == null || depth > 2) return out
  if (typeof error === 'string') {
    if (error.trim()) out.push(error)
    return out
  }
  if (typeof error !== 'object') return out

  const record = error as Record<string, unknown>
  for (const key of ['message', 'responseBody', 'rawDetail', 'finishReason', 'rawFinishReason']) {
    const val = record[key]
    if (typeof val === 'string' && val.trim()) {
      out.push(val)
    }
  }
  if (record.data && typeof record.data === 'object') {
    try {
      out.push(JSON.stringify(record.data))
    } catch {
      // ignore unserializable data
    }
  }
  if (record.cause && record.cause !== error) {
    collectErrorTextParts(record.cause, depth + 1, out)
  }
  return out
}

export function isProviderContentFilterError(error: unknown): boolean {
  if (error == null) return false

  if (typeof error === 'object') {
    const record = error as {
      code?: unknown
      name?: unknown
      finishReason?: unknown
      rawFinishReason?: unknown
      cause?: unknown
    }
    if (
      record.code === PROVIDER_CONTENT_FILTER_ERROR_CODE ||
      record.name === 'ProviderContentFilterError'
    ) {
      return true
    }
    // 客户端本地 schema/prompt 校验错误尚未发出远端请求，不应误判为服务商安全拦截
    if (record.name === 'AI_InvalidPromptError' || record.name === 'AI_TypeValidationError') {
      return false
    }
    if (isContentFilterFinishReason(record.finishReason, record.rawFinishReason)) {
      return true
    }
    if (record.cause && record.cause !== error && isProviderContentFilterError(record.cause)) {
      return true
    }
  }

  const combinedText = collectErrorTextParts(error).join('\n')
  if (!combinedText) return false

  return CONTENT_FILTER_TEXT_PATTERNS.some((pattern) => pattern.test(combinedText))
}

export function localizeStreamDisplayError(
  error: string,
  t: (key: string, fallback: string) => string
): string {
  if (isProviderContentFilterError(error)) {
    return t(PROVIDER_CONTENT_FILTER_I18N_KEY, PROVIDER_CONTENT_FILTER_MESSAGE)
  }
  if (error.includes('VISION_NOT_SUPPORTED')) {
    return t(
      'agent.error.vision_not_supported',
      '当前模型不支持图片识别哦，可以换成视觉模型再试试呢~'
    )
  }
  return error
}
