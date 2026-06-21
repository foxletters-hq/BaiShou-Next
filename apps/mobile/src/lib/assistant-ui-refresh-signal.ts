/** 伙伴编辑保存/删除后标记，Agent 页聚焦时跳过节流强制刷新列表 */
let assistantsNeedRefresh = false

export function markAssistantsNeedRefresh(): void {
  assistantsNeedRefresh = true
}

export function consumeAssistantsNeedRefresh(): boolean {
  if (!assistantsNeedRefresh) return false
  assistantsNeedRefresh = false
  return true
}
