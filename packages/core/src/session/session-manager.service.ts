import {
  SessionRepository,
  InsertSessionInput,
  InsertMessageInput,
  InsertPartInput
} from '@baishou/database'
import { sessionBelongsToActiveVault } from '@baishou/shared'
import { SessionSyncService } from './session-sync.service'
import { SessionFileService } from './session-file.service'
import {
  SessionDiskPersistenceService,
  type SessionDiskFlushUrgency,
  type SessionDiskPersistenceHooks
} from './session-disk-persistence.service'

/**
 * AI 会话总管
 * 拦截对 SQLite 的原子操作，并通过 SessionDiskPersistenceService 调度 JSON 落盘。
 */
export class SessionManagerService {
  private readonly persistence: SessionDiskPersistenceService

  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly fileService: SessionFileService,
    private readonly syncService: SessionSyncService,
    persistenceHooks?: SessionDiskPersistenceHooks
  ) {
    this.persistence = new SessionDiskPersistenceService(sessionRepo, fileService, persistenceHooks)
  }

  async upsertSession(input: InsertSessionInput): Promise<void> {
    await this.sessionRepo.upsertSession(input)
    await this.persistence.flushNow(input.id)
  }

  async insertMessageWithParts(
    message: InsertMessageInput,
    parts: InsertPartInput[]
  ): Promise<void> {
    await this.sessionRepo.insertMessageWithParts(message, parts)
    // 用户消息高频写入：SQLite 即时落库，JSON 防抖落盘（避免每条消息全量序列化阻塞发送）
    this.persistence.notifySessionMutated(message.sessionId, 'debounced')
  }

  async updateTokenUsage(
    id: string,
    inputTokens: number,
    outputTokens: number,
    costMicros: number = 0,
    cacheReadInputTokens: number = 0,
    cacheWriteInputTokens: number = 0
  ): Promise<void> {
    await this.sessionRepo.updateTokenUsage(
      id,
      inputTokens,
      outputTokens,
      costMicros,
      cacheReadInputTokens,
      cacheWriteInputTokens
    )
    await this.persistence.flushNow(id)
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.sessionRepo.togglePin(id, isPinned)
    await this.persistence.flushNow(id)
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    await this.sessionRepo.updateSessionTitle(sessionId, title)
    await this.persistence.flushNow(sessionId)
  }

  async updateSessionDialogueModel(
    sessionId: string,
    providerId: string,
    modelId: string
  ): Promise<void> {
    await this.sessionRepo.updateSessionDialogueModel(sessionId, providerId, modelId)
    await this.persistence.flushNow(sessionId)
  }

  async list(limit: number = 20, offset: number = 0, assistantId?: string, searchQuery?: string) {
    return this.findAllSessions(limit, offset, assistantId, searchQuery)
  }

  async deleteSessions(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.persistence.discard(id)
    }
    await this.sessionRepo.deleteSessions(ids)
    for (const id of ids) {
      await this.fileService.deleteSession(id)
    }
  }

  async getMessagesBySession(sessionId: string, limit: number = 50, offset: number = 0) {
    return this.sessionRepo.getMessagesBySession(sessionId, limit, offset)
  }

  async findAllSessions(
    limit: number = 20,
    offset: number = 0,
    assistantId?: string,
    searchQuery?: string
  ) {
    return this.sessionRepo.findAllSessions(limit, offset, assistantId, searchQuery)
  }

  async getSessionById(sessionId: string) {
    return this.sessionRepo.getSessionById(sessionId)
  }

  /**
   * 外部直接改 SQLite 后登记落盘（统一入口，避免散落 flush 调用）
   */
  notifySessionMutated(sessionId: string, urgency: SessionDiskFlushUrgency = 'immediate'): void {
    this.persistence.notifySessionMutated(sessionId, urgency)
  }

  /** 立即将会话 aggregate 写入 JSON */
  public flushSessionToDisk(sessionId: string): Promise<void> {
    return this.persistence.flushNow(sessionId)
  }

  /** 仅 flush 脏会话（增量同步 / 存储静默前） */
  async flushPendingDiskWrites(): Promise<void> {
    await this.persistence.flushPending()
  }

  /**
   * 增量同步扫描前：先 flush dirty，再把「库有、当前 Sessions 目录无 JSON」的会话补写到盘。
   * 只处理活跃 vault（SessionFileService 读写范围），避免跨 vault 写错目录。
   * activeVaultName 缺失时仅 flushPending，不做缺文件补写。
   */
  async ensureSessionsFlushedToDisk(options?: {
    activeVaultName?: string | null
  }): Promise<{
    flushed: number
    pendingFlushed: boolean
    dbCount: number
    diskCount: number
    skippedMissingScan: boolean
  }> {
    const dirtyBefore = this.persistence.getDirtySessionIds().size
    await this.persistence.flushPending()
    const pendingFlushed = dirtyBefore > 0

    const activeVaultName = options?.activeVaultName?.trim() || null
    if (!activeVaultName) {
      return {
        flushed: 0,
        pendingFlushed,
        dbCount: 0,
        diskCount: 0,
        skippedMissingScan: true
      }
    }

    const dbSessions = await this.sessionRepo.findAllSessions(-1)
    const relevant = dbSessions.filter((s) =>
      sessionBelongsToActiveVault(s.vaultName, activeVaultName)
    )
    const diskSessions = await this.fileService.listAllSessions()
    const diskIds = new Set(diskSessions.map((s) => s.id))

    let flushed = 0
    for (const session of relevant) {
      if (diskIds.has(session.id)) continue
      try {
        await this.persistence.flushNow(session.id)
        flushed++
      } catch (e) {
        console.warn(`[SessionManager] flush missing session ${session.id} failed:`, e)
      }
    }

    return {
      flushed,
      pendingFlushed,
      dbCount: relevant.length,
      diskCount: diskSessions.length,
      skippedMissingScan: false
    }
  }

  async fullResyncFromDisks(
    options?: import('../vault/disk-resync.types').DiskResyncOptions
  ): Promise<void> {
    // 先尽量落盘，再把仍 dirty 的会话排除出幽灵删除（flush 失败 / 竞态）
    try {
      await this.persistence.flushPending()
    } catch (e) {
      console.warn('[SessionManager] flushPending before fullResync failed:', e)
    }
    const preserve = new Set<string>([
      ...this.persistence.getDirtySessionIds(),
      ...(options?.preserveSessionIds ?? [])
    ])
    await this.syncService.fullScanArchives({
      ...options,
      preserveSessionIds: preserve.size > 0 ? preserve : options?.preserveSessionIds
    })
  }
}
