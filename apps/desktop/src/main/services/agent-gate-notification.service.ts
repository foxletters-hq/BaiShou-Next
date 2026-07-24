import { BrowserWindow, Notification } from 'electron'
import {
  AGENT_GATE_NOTIFICATION_TITLE,
  buildAgentGateNotificationBody,
  type AgentGateRequest
} from '@baishou/shared'
import { getAgentGateNotificationPrefs } from './agent-gate-notification-prefs.store'

const activeByRequestId = new Map<string, Notification>()

function anyWindowFocused(): boolean {
  return BrowserWindow.getAllWindows().some((win) => !win.isDestroyed() && win.isFocused())
}

function revealPrimaryWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed())
  const target = windows[0]
  if (!target) return null
  if (target.isMinimized()) target.restore()
  target.show()
  target.focus()
  return target
}

/**
 * 发送系统通知；正文不含路径/命令/Diff。
 * 由主进程在窗口未聚焦时直接调用，或在渲染进程确认「非当前会话」后强制调用。
 */
export async function notifyAgentGateAsked(
  request: AgentGateRequest,
  options?: { force?: boolean }
): Promise<void> {
  if (!Notification.isSupported()) return
  const prefs = await getAgentGateNotificationPrefs()
  if (!prefs.enabled) return
  if (!options?.force && anyWindowFocused()) return
  if (activeByRequestId.has(request.id)) return

  const notification = new Notification({
    title: AGENT_GATE_NOTIFICATION_TITLE,
    body: buildAgentGateNotificationBody(request.sessionId),
    silent: !prefs.soundEnabled
  })

  notification.on('click', () => {
    const target = revealPrimaryWindow()
    if (!target) return
    target.webContents.send('agent-gate:navigate', {
      sessionId: request.sessionId,
      requestId: request.id,
      scope: request.scope
    })
  })

  notification.on('close', () => {
    activeByRequestId.delete(request.id)
  })

  activeByRequestId.set(request.id, notification)
  notification.show()
}

export function closeAgentGateNotification(requestId: string): void {
  const existing = activeByRequestId.get(requestId)
  if (!existing) return
  try {
    existing.close()
  } catch {
    /* ignore */
  }
  activeByRequestId.delete(requestId)
}

export function isAnyAgentGateWindowFocused(): boolean {
  return anyWindowFocused()
}
