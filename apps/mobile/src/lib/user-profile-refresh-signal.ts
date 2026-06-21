type UserProfileRefreshListener = () => void

let userProfileNeedRefresh = false
const listeners = new Set<UserProfileRefreshListener>()

export function markUserProfileNeedRefresh(): void {
  userProfileNeedRefresh = true
}

export function consumeUserProfileNeedRefresh(): boolean {
  if (!userProfileNeedRefresh) return false
  userProfileNeedRefresh = false
  return true
}

export function subscribeUserProfileRefresh(listener: UserProfileRefreshListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 设置页保存用户资料 / 聊天背景后调用，Agent 页立即或聚焦时刷新 */
export function notifyUserProfileRefresh(): void {
  markUserProfileNeedRefresh()
  listeners.forEach((fn) => fn())
}
