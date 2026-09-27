/** 设备级 Gate 系统通知偏好（不混入权限策略） */
export interface AgentGateNotificationPrefs {
  /** 是否发送系统通知 */
  enabled: boolean
  /** 是否播放通知声音（宿主支持时） */
  soundEnabled: boolean
}

export const DEFAULT_AGENT_GATE_NOTIFICATION_PREFS: AgentGateNotificationPrefs = {
  enabled: true,
  soundEnabled: true
}

export function normalizeAgentGateNotificationPrefs(value: unknown): AgentGateNotificationPrefs {
  const input =
    value && typeof value === 'object' ? (value as Partial<AgentGateNotificationPrefs>) : {}
  return {
    enabled:
      typeof input.enabled === 'boolean'
        ? input.enabled
        : DEFAULT_AGENT_GATE_NOTIFICATION_PREFS.enabled,
    soundEnabled:
      typeof input.soundEnabled === 'boolean'
        ? input.soundEnabled
        : DEFAULT_AGENT_GATE_NOTIFICATION_PREFS.soundEnabled
  }
}

/** 通知正文只含非敏感摘要，不带会话 ID */
export function buildAgentGateNotificationBody(): string {
  return '需要确认一项操作'
}

export const AGENT_GATE_NOTIFICATION_TITLE = '白守 · 待确认'

export const AGENT_GATE_NOTIFICATION_PREVIEW_TITLE = '白守 · 系统通知'
export const AGENT_GATE_NOTIFICATION_PREVIEW_BODY = '已开启。伙伴需要你确认操作时会这样提醒。'

export interface AgentGateNotificationPreviewResult {
  success: boolean
  reason?: 'unsupported' | 'failed'
}
