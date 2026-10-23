export type InputBarPrimaryAction = 'send' | 'stop'

/**
 * 流式生成中且输入框为空：暂停。
 * 输入框有可发送内容：发送（工作台流式中仍可排队发送）。
 */
export function resolveInputBarPrimaryAction(input: {
  isLoading: boolean
  canSend: boolean
  allowSendWhileLoading?: boolean
  hasStopHandler?: boolean
}): InputBarPrimaryAction {
  const canSendNow = input.canSend && (!input.isLoading || input.allowSendWhileLoading === true)
  if (canSendNow) return 'send'
  if (input.isLoading && input.hasStopHandler !== false) return 'stop'
  return 'send'
}
