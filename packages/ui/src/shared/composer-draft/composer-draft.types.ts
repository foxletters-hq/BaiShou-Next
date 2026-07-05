export interface ComposerDraftPayload {
  text: string
}

export interface ComposerDraftStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type ComposerSendResult = boolean | Promise<boolean>

/** onSend 返回 false 时保留输入框内容与草稿 */
export type ComposerOnSend = (
  text: string,
  attachments?: unknown[],
  searchMode?: boolean
) => ComposerSendResult
