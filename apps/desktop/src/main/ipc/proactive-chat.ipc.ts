import { ipcMain } from 'electron'
import type { ProactiveChatSettings } from '@baishou/core/shared'
import { DesktopProactiveChatService } from '../services/proactive-chat.service'
import { logger } from '@baishou/shared'

// 桌面端主动互动 IPC：注册渲染进程与主进程之间的通信通道
// 调用方：apps/desktop/src/main/index.ts（主进程启动时调用 registerProactiveChatIPC）
// API：proactive-chat:initialize、proactive-chat:start、proactive-chat:stop、proactive-chat:schedule-greeting
// 用户指示：按 MVP → P1 → P2 实现 AI 主动互动，使用 TDD 红→绿→重构，遵守项目规范

let proactiveChatService: DesktopProactiveChatService | null = null

export function registerProactiveChatIPC(db: any, defaultAssistantId: string): void {
  logger.info('[ProactiveChatIPC] 注册主动互动 IPC 通道')

  proactiveChatService = new DesktopProactiveChatService(db, defaultAssistantId)

  ipcMain.handle('proactive-chat:initialize', async (_event, settings: ProactiveChatSettings) => {
    try {
      if (!proactiveChatService) {
        throw new Error('ProactiveChatService 未创建')
      }
      await proactiveChatService.initialize(settings)
      return { success: true }
    } catch (error) {
      logger.error('[ProactiveChatIPC] 初始化失败', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('proactive-chat:start', async () => {
    try {
      if (!proactiveChatService) {
        throw new Error('ProactiveChatService 未初始化')
      }
      await proactiveChatService.start()
      return { success: true }
    } catch (error) {
      logger.error('[ProactiveChatIPC] 启动失败', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('proactive-chat:stop', async () => {
    try {
      if (!proactiveChatService) {
        return { success: true }
      }
      await proactiveChatService.stop()
      return { success: true }
    } catch (error) {
      logger.error('[ProactiveChatIPC] 停止失败', error as Error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'proactive-chat:schedule-greeting',
    async (_event, type: 'morning' | 'evening', hour: number, minute: number) => {
      try {
        if (!proactiveChatService) {
          throw new Error('ProactiveChatService 未初始化')
        }

        if (type === 'morning') {
          proactiveChatService.scheduleMorningGreeting(hour, minute)
        } else {
          proactiveChatService.scheduleEveningGreeting(hour, minute)
        }

        return { success: true }
      } catch (error) {
        logger.error('[ProactiveChatIPC] 调度问候失败', error as Error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )
}

export function getProactiveChatService(): DesktopProactiveChatService | null {
  return proactiveChatService
}
