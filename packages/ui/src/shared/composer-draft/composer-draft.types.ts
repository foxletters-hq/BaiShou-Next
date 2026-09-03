import type { PromptFileRef } from '@baishou/shared'

export interface ComposerDraftPayload {
  text: string
}

export interface ComposerDraftStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type ComposerSendResult = boolean | Promise<boolean>

/** 发送时附带的展示元数据：气泡显示 /command，模型仍用展开后的 text */
export type ComposerSendSkillRef = {
  command: string
  content: string
}

export type ComposerSendFileRef = PromptFileRef

export type ComposerSendMeta = {
  /** 含 `/command` 的展示文案 */
  displayText?: string
  skillRefs?: ComposerSendSkillRef[]
  fileRefs?: ComposerSendFileRef[]
  /** 忙时投递：插入当前 / 排队 */
  delivery?: 'steer' | 'queue'
}

/** onSend 返回 false 时保留输入框内容与草稿 */
export type ComposerOnSend = (
  text: string,
  attachments?: unknown[],
  searchMode?: boolean,
  meta?: ComposerSendMeta
) => ComposerSendResult
