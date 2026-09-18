import {
  SessionRepository,
  AssistantRepository,
  MessageRepository,
  connectionManager,
  SnapshotRepository
} from '@baishou/database-desktop'
import {
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService
} from '@baishou/core-desktop'
import { AgentSessionService, ToolRegistry } from '@baishou/ai'
import { DesktopAttachmentManagerService } from '../services/desktop-attachment-manager.service'
import { getRawDataSourceManager } from '../services/raw-data-source.runtime'
import { fileSystem, pathService, resolveActiveVaultId } from './vault.ipc'

export const toolRegistry = new ToolRegistry()
export const agentService = new AgentSessionService()

type AgentManagers = {
  sessionManager: SessionManagerService
  assistantManager: AssistantManagerService
  attachmentManager: DesktopAttachmentManagerService
  realMessageRepo: MessageRepository
  realSessionRepo: SessionRepository
  realSnapshotRepo: SnapshotRepository
  realAssistantRepo: AssistantRepository
}

let cachedAgentManagers: AgentManagers | null = null
let cachedAgentManagersDb: ReturnType<typeof connectionManager.getDb> | null = null

/** DB 热切换后丢弃缓存（通常 setDb 换引用后会自动重建；显式调用更稳妥） */
export function invalidateAgentManagers(): void {
  cachedAgentManagers = null
  cachedAgentManagersDb = null
}

// 按当前 DB 句柄缓存：跨 IPC 共享 SessionManager dirty，使同步前 flushPending 生效
export function getAgentManagers(): AgentManagers {
  const db = connectionManager.getDb()
  if (cachedAgentManagers && cachedAgentManagersDb === db) {
    return cachedAgentManagers
  }

  const realSessionRepo = new SessionRepository(db)
  const sessionFileService = new SessionFileService(
    pathService,
    fileSystem,
    getRawDataSourceManager()
  )
  const sessionSyncService = new SessionSyncService(realSessionRepo, sessionFileService)
  const sessionManager = new SessionManagerService(
    realSessionRepo,
    sessionFileService,
    sessionSyncService,
    {
      onBeforeWrite: (sessionId) => {
        void (async () => {
          try {
            const { sessionWatcher } = await import('../services/session-watcher.service')
            const vaultPath = await pathService.getActiveVaultPath()
            if (!vaultPath) return
            const { join } = await import('path')
            sessionWatcher.suppressPath(join(vaultPath, 'Sessions', `${sessionId}.json`))
          } catch {
            // watcher 未启动时忽略
          }
        })()
      }
    }
  )

  const realAssistantRepo = new AssistantRepository(db, () => resolveActiveVaultId())
  const assistantFileService = new AssistantFileService(pathService, fileSystem)
  const attachmentManager = new DesktopAttachmentManagerService(pathService)
  const assistantManager = new AssistantManagerService(
    realAssistantRepo,
    assistantFileService,
    attachmentManager,
    () => resolveActiveVaultId()
  )

  const realMessageRepo = new MessageRepository(db)
  const realSnapshotRepo = new SnapshotRepository(db)

  cachedAgentManagersDb = db
  cachedAgentManagers = {
    sessionManager,
    assistantManager,
    attachmentManager,
    realMessageRepo,
    realSessionRepo,
    realSnapshotRepo,
    realAssistantRepo
  }
  return cachedAgentManagers
}
