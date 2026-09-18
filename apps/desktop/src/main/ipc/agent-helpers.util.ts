/** 会话/工作台选了具体档时覆盖设置默认；auto 仍走设置项，请求侧会物化成具体 effort */
export function applySessionReasoningEffort<T extends Record<string, unknown>>(
  userConfig: T,
  reasoningEffort?: string | null
): T {
  if (typeof reasoningEffort === 'string' && reasoningEffort && reasoningEffort !== 'auto') {
    return { ...userConfig, reasoningEffort } as T
  }
  return userConfig
}
