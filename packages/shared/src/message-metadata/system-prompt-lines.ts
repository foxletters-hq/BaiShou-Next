import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from './constants'

/**
 * How historical message metadata appears in model context (read-only).
 * Only inject when the host actually wraps per-message timestamps.
 */
export function buildContextEncodingSystemPromptLines(): string[] {
  return [
    '[Historical messages]',
    'The host may wrap stored messages for context only (not author wording):',
    `- <${MESSAGE_TIME_TAG}>YYYY-MM-DD HH:mm</${MESSAGE_TIME_TAG}> — when THAT message was sent.`,
    `- <${MESSAGE_CONTENT_TAG}>…</${MESSAGE_CONTENT_TAG}> — that message's stored body.`,
    'User, assistant, system, and tool messages may use this wrapper when replayed.',
    '',
    '[Rules]',
    `Use each message's <${MESSAGE_TIME_TAG}> only to interpret when that past message was sent.`,
    'Do not copy this encoding into your reply.',
    'Do not add new timestamp tags.'
  ]
}

/**
 * @deprecated Prefer buildContextEncodingSystemPromptLines + buildOutputProtocolSystemPromptLines.
 * Kept for callers that still expect a combined metadata + output block.
 */
export function buildMessageMetadataSystemPromptLines(options?: {
  injectCurrentTime?: boolean
}): string[] {
  const injectCurrentTime = options?.injectCurrentTime !== false

  if (!injectCurrentTime) {
    return [
      '[Time references]',
      'Use the **current_time** tool when you need the current date/time for "now".',
      'Historical messages are replayed as plain text without per-message timestamps.'
    ]
  }

  return buildContextEncodingSystemPromptLines()
}
