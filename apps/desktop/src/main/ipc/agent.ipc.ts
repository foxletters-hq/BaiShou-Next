import { registerAssistantIPC } from './agent-assistant.ipc'
import { registerSessionIPC } from './agent-session.ipc'
import { registerChatIPC } from './agent-chat.ipc'
import { registerTtsIPC } from './tts.ipc'
import { TitleGeneratorService } from '@baishou/ai/src/agent/title-generator.service'
import { getAgentManagers } from './agent-helpers'
import { BrowserWindow } from 'electron'
import { logger } from '@baishou/shared'

export { getAgentManagers } from './agent-helpers'

export function registerAgentIPC() {
  registerAssistantIPC()
  registerSessionIPC()
  registerChatIPC()
  registerTtsIPC()

  // 绑定自动命名成功后的回调，同步到磁盘并通知前端刷新
  TitleGeneratorService.onTitleUpdated = async (sessionId, newTitle) => {
    try {
      const { sessionManager } = getAgentManagers()
      // 将更改 flush 到 JSON 文件中，确立跨端 SSOT 持久化
      await sessionManager.flushSessionToDisk(sessionId)

      // 通知渲染进程标题被修改，让前端可以刷新列表
      const wins = BrowserWindow.getAllWindows()
      wins.forEach((w) => {
        w.webContents.send('session:file-changed')
      })
      logger.info(
        `[AutoTitler Callback] Title update flushed and broadcasted for ${sessionId}: ${newTitle}`
      )
    } catch (e: any) {
      logger.error('[AutoTitler Callback] Failed to flush or notify title update:', e)
    }
  }
}
