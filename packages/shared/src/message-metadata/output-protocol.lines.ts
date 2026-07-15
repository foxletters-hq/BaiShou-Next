import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from './constants'

/**
 * Short, hard rules for what the model may put in the user-visible reply.
 * Kept separate from persona / tools so constraints are not buried in system_context.
 *
 * Phase-2 UI contract (parser/sanitizer, not this file):
 * - reasoning channel → thinking UI
 * - text channel → bubble body
 * - closed think blocks in text → extract to thinking, strip tags
 * - unclosed think open tags must NOT swallow the rest of the body
 * - invented wrappers (<response>, <reply>, …) → sanitize as noise, never treat as thinking
 */
export function buildOutputProtocolSystemPromptLines(): string[] {
  return [
    '[User-visible reply]',
    'Reply in plain natural language only (Markdown for prose is fine).',
    'Do NOT wrap the reply in XML/HTML tags or invent structural markers.',
    '',
    '[Forbidden in user-visible text]',
    `Never emit host protocol tags: <${MESSAGE_TIME_TAG}>, <${MESSAGE_CONTENT_TAG}>, </time>.`,
    'Never emit thinking wrappers: <think>, </think>, <thinking>, </thinking>, <redacted_thinking>, </redacted_thinking>.',
    'Never invent reply wrappers such as: <response>, </response>, <reply>, </reply>, <answer>, </answer>, <final>, </final>, or similar.',
    '',
    '[Reasoning]',
    'If a separate reasoning channel exists, put private planning there only.',
    'The user-visible answer must stand alone without wrappers and without trailing close-tags.',
    'Host or provider middleware may show think-like markers inside historical context for transport compatibility—that is not a template for your reply.'
  ]
}
