import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from './constants'

/**
 * How historical send times appear in model context (read-only).
 * Times come from stored createdAt and wrap each message body sent to the model.
 */
export function buildContextEncodingSystemPromptLines(): string[] {
  return [
    '[Historical messages]',
    'Each historical message is wrapped by the host as:',
    `<${MESSAGE_TIME_TAG}>YYYY-MM-DD HH:mm</${MESSAGE_TIME_TAG}>`,
    `<${MESSAGE_CONTENT_TAG}>`,
    'stored message body',
    `</${MESSAGE_CONTENT_TAG}>`,
    'The time is the persisted send time, not author wording.',
    '',
    '[Rules]',
    `Do not copy <${MESSAGE_TIME_TAG}>, <${MESSAGE_CONTENT_TAG}>, or invent timestamp tags in your reply.`
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
