import { Notification } from 'electron'
import { logger } from '@baishou/shared'

// 桌面端通知服务：使用 Electron Notification API 发送系统通知
// 调用方：apps/desktop/src/main/services/proactive-chat.service.ts（ProactiveChatService 依赖注入）
// API：sendNotification
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目规范

export interface NotificationOptions {
  title: string
  body: string
  sessionId?: string
  silent?: boolean
}

export class NotificationService {
  async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: options.silent ?? false,
        timeoutType: 'default'
      })

      notification.on('click', () => {
        logger.info('[NotificationService] 用户点击通知', { sessionId: options.sessionId })
        // TODO: 跳转到对应会话
      })

      notification.show()
      logger.info('[NotificationService] 通知已发送', { title: options.title })
    } catch (error) {
      logger.error('[NotificationService] 发送通知失败', error as Error)
      throw error
    }
  }

  isSupported(): boolean {
    return Notification.isSupported()
  }
}
