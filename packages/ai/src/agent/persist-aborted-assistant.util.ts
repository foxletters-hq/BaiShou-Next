/**
 * 用户点停止时，是否把已经生成的半成品助手消息落盘。
 * 被后一次流顶替时仍不落盘。
 */
export function shouldPersistPartialAssistantAfterStop(input: {
  userAborted: boolean
  doomTripped: boolean
  superseded: boolean
  hasModelOutput: boolean
}): boolean {
  if (!input.userAborted) return false
  if (input.superseded) return false
  return input.hasModelOutput
}
