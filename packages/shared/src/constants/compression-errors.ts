/** 压缩 / 重新压缩错误码（IPC 与 UI 可映射 i18n） */
export const CompressionErrorCode = {
  NO_SNAPSHOT: 'compress.no_snapshot',
  NOT_ENOUGH_MESSAGES: 'compress.not_enough_messages',
  NO_USER_CONTENT: 'compress.no_user_content',
  EMPTY_SUMMARY: 'compress.empty_summary',
  VERBATIM_SUMMARY: 'compress.verbatim_summary',
  ALREADY_RUNNING: 'compress.already_running',
  SESSION_NOT_FOUND: 'compress.session_not_found',
  NO_MODEL: 'compress.no_model',
  GENERIC: 'compress.generic'
} as const

export type CompressionErrorCode = (typeof CompressionErrorCode)[keyof typeof CompressionErrorCode]

/** 默认中文文案（无 i18n 时回退） */
export const COMPRESSION_ERROR_MESSAGES_ZH: Record<CompressionErrorCode, string> = {
  [CompressionErrorCode.NO_SNAPSHOT]: '当前会话没有可重新压缩的快照。',
  [CompressionErrorCode.NOT_ENOUGH_MESSAGES]: '压缩区间内消息不足，快照锚点可能已从历史中丢失。',
  [CompressionErrorCode.NO_USER_CONTENT]: '压缩区间内没有用户正文，无法生成对话摘要。',
  [CompressionErrorCode.EMPTY_SUMMARY]: '模型未返回有效摘要。',
  [CompressionErrorCode.VERBATIM_SUMMARY]:
    '摘要与最后一条助手回复几乎相同，请调整压缩提示词后重试。',
  [CompressionErrorCode.ALREADY_RUNNING]: '该会话正在压缩中，请稍候。',
  [CompressionErrorCode.SESSION_NOT_FOUND]: '找不到该会话。',
  [CompressionErrorCode.NO_MODEL]: '未配置对话模型。',
  [CompressionErrorCode.GENERIC]: '压缩失败，请稍后重试。'
}

export function compressionError(
  code: CompressionErrorCode,
  detail?: string
): { ok: false; error: string; errorCode: CompressionErrorCode } {
  const message = detail?.trim() || COMPRESSION_ERROR_MESSAGES_ZH[code]
  return { ok: false, error: message, errorCode: code }
}
