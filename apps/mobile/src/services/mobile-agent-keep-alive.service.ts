import { Platform } from 'react-native'
import i18n from 'i18next'
import { logger } from '@baishou/shared'
import {
  startAgentKeepAlive,
  stopAgentKeepAlive,
  isAgentKeepAliveActive
} from 'expo-baishou-server'

/**
 * 申请 AI 流式请求后台保活。
 * 在 Android 上启动前台服务（带通知栏常驻提示），避免应用切入后台被系统挂起（Freeze）或掐断网络连接。
 */
export function acquireAgentStreamKeepAlive(
  sessionId?: string,
  options?: { title?: string; content?: string }
): void {
  if (Platform.OS !== 'android') {
    return
  }

  try {
    const title =
      options?.title?.trim() ||
      i18n.t('auto.apps.mobile.src.services.mobile.agent.keep.alive.title', '白守正在生成回复...')
    const content =
      options?.content?.trim() ||
      i18n.t(
        'auto.apps.mobile.src.services.mobile.agent.keep.alive.content',
        '后台运行中，可返回应用查看思考与回复进度'
      )
    const started = startAgentKeepAlive(sessionId, title, content)
    if (!started) {
      logger.debug('[MobileAgentKeepAlive] startAgentKeepAlive returned false or no-op')
    }
  } catch (error) {
    logger.warn('[MobileAgentKeepAlive] Failed to acquire keep-alive:', error as Error)
  }
}

/**
 * 释放 AI 流式请求后台保活。
 * 当会话完成、出错或用户主动打断时调用。
 */
export function releaseAgentStreamKeepAlive(sessionId?: string): void {
  if (Platform.OS !== 'android') {
    return
  }

  try {
    stopAgentKeepAlive(sessionId)
  } catch (error) {
    logger.warn('[MobileAgentKeepAlive] Failed to release keep-alive:', error as Error)
  }
}

export function checkAgentStreamKeepAliveActive(): boolean {
  if (Platform.OS !== 'android') {
    return false
  }

  try {
    return isAgentKeepAliveActive()
  } catch {
    return false
  }
}
