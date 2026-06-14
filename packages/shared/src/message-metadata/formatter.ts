import { formatMessageTimestamp } from '../utils/date.utils'
import { MESSAGE_CONTENT_TAG, MESSAGE_TIME_TAG } from './constants'

export function buildMessageTimeLine(createdAt?: Date | number | null): string | null {
  const ts = formatMessageTimestamp(createdAt)
  return ts ? `<${MESSAGE_TIME_TAG}>${ts}</${MESSAGE_TIME_TAG}>\n` : null
}

export function wrapMessageContentBlock(body: string): string {
  const trimmed = body.trimEnd()
  if (!trimmed) {
    return `<${MESSAGE_CONTENT_TAG}></${MESSAGE_CONTENT_TAG}>`
  }
  return `<${MESSAGE_CONTENT_TAG}>\n${trimmed}\n</${MESSAGE_CONTENT_TAG}>`
}

/** 将存储正文包裹为 <message-time> + <message-content>（仅用于模型上下文，不落库） */
export function wrapMessageBodyForModel(body: string, createdAt?: Date | number | null): string {
  const timeLine = buildMessageTimeLine(createdAt)
  if (!timeLine) return body
  return `${timeLine}${wrapMessageContentBlock(body)}`
}

export function prefixTextWithMessageTimestamp(text: string, at?: Date | number | null): string {
  return wrapMessageBodyForModel(text, at ?? new Date())
}
