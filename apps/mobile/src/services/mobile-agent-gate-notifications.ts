import { AppState } from 'react-native'
import {
  AGENT_GATE_NOTIFICATION_TITLE,
  buildAgentGateNotificationBody,
  type AgentGateRequest
} from '@baishou/shared'
import { useAgentGateInboxStore } from '@baishou/store'
import { getMobileAgentGateNotificationPrefs } from './mobile-agent-gate-notification-prefs.service'
import {
  hydrateMobileAgentGateInbox,
  subscribeMobileAgentGateEvents
} from './mobile-agent-gate.service'

type NotificationsModule = typeof import('expo-notifications')

let Notifications: NotificationsModule | null = null
let started = false
const localIdsByRequest = new Map<string, string>()
let navigateHandler: ((sessionId: string, requestId: string) => void) | null = null
/** 当前前台聚焦的会话；同会话前台不弹系统通知，跨会话仍提示 */
let focusedSessionId: string | null = null
const HANDLED_RESPONSE_STORAGE_KEY = 'agent_gate_last_handled_notif_response'
let handledResponseKeyMemory: string | null = null

async function loadAsyncStorage(): Promise<typeof import('@react-native-async-storage/async-storage').default | null> {
  try {
    return (await import('@react-native-async-storage/async-storage')).default
  } catch {
    return null
  }
}

async function wasNotificationResponseHandled(key: string): Promise<boolean> {
  if (handledResponseKeyMemory === key) return true
  const storage = await loadAsyncStorage()
  if (!storage) return false
  try {
    const stored = await storage.getItem(HANDLED_RESPONSE_STORAGE_KEY)
    if (stored === key) {
      handledResponseKeyMemory = key
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

async function markNotificationResponseHandled(key: string): Promise<void> {
  handledResponseKeyMemory = key
  const storage = await loadAsyncStorage()
  if (!storage) return
  try {
    await storage.setItem(HANDLED_RESPONSE_STORAGE_KEY, key)
  } catch {
    /* ignore */
  }
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Notifications) return Notifications
  try {
    Notifications = await import('expo-notifications')
    return Notifications
  } catch {
    return null
  }
}

export function setMobileAgentGateNotificationNavigateHandler(
  handler: ((sessionId: string, requestId: string) => void) | null
): void {
  navigateHandler = handler
}

export function setMobileAgentGateFocusedSessionId(sessionId: string | null): void {
  focusedSessionId = sessionId
}

async function ensurePermission(mod: NotificationsModule): Promise<boolean> {
  const prefs = await getMobileAgentGateNotificationPrefs()
  if (!prefs.enabled) return false
  const current = await mod.getPermissionsAsync()
  if (current.granted || current.ios?.status === mod.IosAuthorizationStatus.PROVISIONAL) {
    return true
  }
  const asked = await mod.requestPermissionsAsync()
  return Boolean(asked.granted || asked.ios?.status === mod.IosAuthorizationStatus.PROVISIONAL)
}

async function presentAsked(request: AgentGateRequest): Promise<void> {
  const prefs = await getMobileAgentGateNotificationPrefs()
  if (!prefs.enabled) return
  // 前台且正看该会话：应用内卡片/badge 即可；后台或跨会话仍发通知
  if (AppState.currentState === 'active' && focusedSessionId === request.sessionId) {
    return
  }
  const mod = await loadNotifications()
  if (!mod) return
  const allowed = await ensurePermission(mod)
  if (!allowed) return
  if (localIdsByRequest.has(request.id)) return

  const id = await mod.scheduleNotificationAsync({
    content: {
      title: AGENT_GATE_NOTIFICATION_TITLE,
      body: buildAgentGateNotificationBody(request.sessionId),
      data: { requestId: request.id, sessionId: request.sessionId },
      sound: prefs.soundEnabled
    },
    trigger: null
  })
  localIdsByRequest.set(request.id, id)
}

async function dismissReplied(requestId: string): Promise<void> {
  const id = localIdsByRequest.get(requestId)
  if (!id) return
  const mod = await loadNotifications()
  if (mod) {
    try {
      await mod.dismissNotificationAsync(id)
    } catch {
      /* ignore */
    }
  }
  localIdsByRequest.delete(requestId)
}

async function handleNotificationResponse(
  data: Record<string, unknown> | undefined,
  responseKey: string
): Promise<void> {
  const requestId = typeof data?.requestId === 'string' ? data.requestId : null
  const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : null
  if (!requestId || !sessionId) return
  if (await wasNotificationResponseHandled(responseKey)) return
  await hydrateMobileAgentGateInbox()
  const stillPending = useAgentGateInboxStore
    .getState()
    .pending.some((item) => item.id === requestId)
  if (!stillPending) {
    await markNotificationResponseHandled(responseKey)
    return
  }
  await markNotificationResponseHandled(responseKey)
  useAgentGateInboxStore.getState().setFocusedRequest(sessionId, requestId)
  navigateHandler?.(sessionId, requestId)
}

function buildNotificationResponseKey(response: {
  notification: { date?: number; request: { identifier?: string; content: { data?: unknown } } }
}): string {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined
  const requestId = typeof data?.requestId === 'string' ? data.requestId : ''
  const identifier = response.notification.request.identifier ?? ''
  const date = response.notification.date ?? 0
  return `${identifier}:${requestId}:${date}`
}

/**
 * 根布局注册：前台 handler、点击监听、冷启动响应。
 */
export async function ensureMobileAgentGateNotifications(): Promise<() => void> {
  if (started) return () => {}
  started = true

  const mod = await loadNotifications()
  const unsubscribers: Array<() => void> = []

  unsubscribers.push(
    subscribeMobileAgentGateEvents((event) => {
      if (event.type === 'agent_gate.asked') {
        void presentAsked(event.request)
        return
      }
      if (event.type === 'agent_gate.replied') {
        void dismissReplied(event.requestId)
      }
    })
  )

  if (!mod) {
    return () => {
      for (const unsub of unsubscribers) unsub()
      started = false
    }
  }

  mod.setNotificationHandler({
    handleNotification: async () => {
      const prefs = await getMobileAgentGateNotificationPrefs()
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: prefs.soundEnabled,
        shouldSetBadge: true
      }
    }
  })

  unsubscribers.push(
    mod.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(
        response.notification.request.content.data as Record<string, unknown>,
        buildNotificationResponseKey(response)
      )
    }).remove
  )

  const last = await mod.getLastNotificationResponseAsync()
  if (last) {
    void handleNotificationResponse(
      last.notification.request.content.data as Record<string, unknown>,
      buildNotificationResponseKey(last)
    )
  }

  return () => {
    for (const unsub of unsubscribers) unsub()
    started = false
  }
}
