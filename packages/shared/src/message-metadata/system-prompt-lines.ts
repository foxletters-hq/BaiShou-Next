import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from './constants'

/**
 * English rules for how historical message metadata appears in context.
 * Kept next to formatter constants so tag names stay in sync with inject/sanitize.
 */
export function buildMessageMetadataSystemPromptLines(): string[] {
  return [
    '[Historical message format]',
    'The host injects metadata around stored text in context (this is not part of the author\'s original wording):',
    `- <${MESSAGE_TIME_TAG}>YYYY-MM-DD HH:mm</${MESSAGE_TIME_TAG}> — when THAT message was sent.`,
    `- <${MESSAGE_CONTENT_TAG}>…</${MESSAGE_CONTENT_TAG}> — that message's stored body.`,
    'User, assistant, system, and tool messages may use this wrapper when replayed.',
    '',
    '[Time references]',
    'Use [System Current Date / Time] below for "now".',
    `Use each message's <${MESSAGE_TIME_TAG}> only to interpret when that past message was sent.`,
    'Do not add new timestamp tags or blocks to your reply.',
    '',
    '[Output format]',
    'Reply with plain natural language only.',
    `Never output <${MESSAGE_TIME_TAG}>, <${MESSAGE_CONTENT_TAG}>, </time>, <thinking>, </thinking>, <think>, or similar markup.`,
    'If the model exposes a separate reasoning channel, keep reasoning there; put the user-visible answer in normal text without wrappers.'
  ]
}
