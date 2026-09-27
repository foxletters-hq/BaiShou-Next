import { i18n, type AgentGateNotificationPrefs } from '@baishou/shared'
import { toast } from '@baishou/ui'

/**
 * 写入设备级通知偏好；刚打开开关时立刻发一条系统预览。
 * 预览失败不回滚偏好：应用内确认卡仍然可用。
 */
export async function persistDesktopAgentGateNotificationPrefs(
  patch: Partial<AgentGateNotificationPrefs>
): Promise<AgentGateNotificationPrefs> {
  const prefs = await window.api.agentGate.setNotificationPrefs(patch)
  if (patch.enabled !== true) return prefs
  try {
    const preview = await window.api.agentGate.previewNotification()
    if (!preview.success) {
      toast.showWarning(
        preview.reason === 'unsupported'
          ? i18n.t('settings.agent_gate_notify_unsupported', '当前系统不支持系统通知')
          : i18n.t(
              'settings.agent_gate_notify_preview_failed',
              '系统通知预览未能显示，请检查系统通知权限'
            )
      )
    }
  } catch {
    toast.showWarning(
      i18n.t(
        'settings.agent_gate_notify_preview_failed',
        '系统通知预览未能显示，请检查系统通知权限'
      )
    )
  }
  return prefs
}
