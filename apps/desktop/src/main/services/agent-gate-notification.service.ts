import { BrowserWindow, Notification } from 'electron'
import {
  AGENT_GATE_NOTIFICATION_PREVIEW_BODY,
  AGENT_GATE_NOTIFICATION_PREVIEW_TITLE,
  AGENT_GATE_NOTIFICATION_TITLE,
  buildAgentGateNotificationBody,
  type AgentGateNotificationPreviewResult,
  type AgentGateRequest
} from '@baishou/shared'
import { getAgentGateNotificationPrefs } from './agent-gate-notification-prefs.store'
import { ensureWindowsToastShortcut, getWindowsToastIconPath } from './windows-toast-identity'

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

function presentNativeNotification(input: {
  requestId: string
  title: string
  body: string
  silent: boolean
  onClick?: () => void
}): boolean {
  ensureWindowsToastShortcut()
  if (!Notification.isSupported()) return false
  if (activeByRequestId.has(input.requestId)) return true
  try {
    const icon = getWindowsToastIconPath()
    const notification = new Notification({
      title: input.title,
      body: input.body,
      silent: input.silent,
      ...(icon ? { icon } : {})
    })
    if (input.onClick) {
      notification.on('click', input.onClick)
    }
    notification.on('close', () => {
      activeByRequestId.delete(input.requestId)
    })
    notification.on('failed', () => {
      activeByRequestId.delete(input.requestId)
    })
    activeByRequestId.set(input.requestId, notification)
    notification.show()
    return true
  } catch {
    return false
  }
}

/**
 * 发送系统通知；正文不含路径/命令/Diff。
 * 由主进程在窗口未聚焦时直接调用，或在渲染进程确认「非当前会话」后强制调用。
 */
export async function notifyAgentGateAsked(
  request: AgentGateRequest,
  options?: { force?: boolean }
): Promise<void> {
  const prefs = await getAgentGateNotificationPrefs()
  if (!prefs.enabled) return
  if (!options?.force && anyWindowFocused()) return
  presentNativeNotification({
    requestId: request.id,
    title: AGENT_GATE_NOTIFICATION_TITLE,
    body: buildAgentGateNotificationBody(),
    silent: !prefs.soundEnabled,
    onClick: () => {
      const target = revealPrimaryWindow()
      if (!target) return
      target.webContents.send('agent-gate:navigate', {
        sessionId: request.sessionId,
        requestId: request.id,
        scope: request.scope
      })
    }
  })
}

/** 设置里刚打开开关：强制弹一条预览，确认本机 Toast 通道可用 */
export async function previewAgentGateNotification(): Promise<AgentGateNotificationPreviewResult> {
  if (!Notification.isSupported()) {
    return { success: false, reason: 'unsupported' }
  }
  const prefs = await getAgentGateNotificationPrefs()
  const shown = presentNativeNotification({
    requestId: `preview_${Date.now()}`,
    title: AGENT_GATE_NOTIFICATION_PREVIEW_TITLE,
    body: AGENT_GATE_NOTIFICATION_PREVIEW_BODY,
    silent: !prefs.soundEnabled,
    onClick: () => {
      revealPrimaryWindow()
    }
  })
  return shown ? { success: true } : { success: false, reason: 'failed' }
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
