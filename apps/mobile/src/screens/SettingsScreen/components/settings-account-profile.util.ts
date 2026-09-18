import { invalidateChatBackgroundDisplayCache } from '../../../lib/chat-background-display.util'
import { invalidateAgentUserProfileCache } from '../../../lib/agent-user-profile.util'
import { notifyUserProfileRefresh } from '../../../lib/user-profile-refresh-signal'

export function notifyAgentProfileRefresh(options?: { chatBackgroundChanged?: boolean }) {
  invalidateAgentUserProfileCache()
  if (options?.chatBackgroundChanged) {
    invalidateChatBackgroundDisplayCache()
  }
  notifyUserProfileRefresh()
}
