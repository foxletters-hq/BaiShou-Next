import {
  SessionRepository,
  InsertSessionInput,
  InsertMessageInput,
  InsertPartInput
} from '@baishou/database'
import { resolveSessionFlushTargetVault } from '@baishou/shared'
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
   * 增量同步扫描前：先 flush dirty，再把「库有、各工作区 Sessions 目录无 JSON」的会话补写到盘。
   * 覆盖全部伙伴会话（不限当前活跃 vault）；按会话 vaultName 写到对应工作区目录。
   * 无可用目标 vault 时仅 flushPending。
   */
  async ensureSessionsFlushedToDisk(options?: {
    activeVaultName?: string | null
    /** 磁盘上已有的工作区目录名；用于跨 vault 补写与存在性判断 */
    diskVaultNames?: string[] | null
    /**
     * pending-only：只 flush dirty，不补写「库有盘无」会话。
     * 规划阶段用，减少计划期磁盘漂移。
     */
    mode?: 'full' | 'pending-only'
  }): Promise<{
    flushed: number
    pendingFlushed: boolean
    dbCount: number
    diskCount: number
    skippedMissingScan: boolean
    dbTotalCount: number
    skippedOtherVaultCount: number
    missingIds: string[]
    failedIds: string[]
    activeVaultName: string | null
  }> {
    const dirtyBefore = this.persistence.getDirtySessionIds().size
    await this.persistence.flushPending()
    const pendingFlushed = dirtyBefore > 0

    const activeVaultName = options?.activeVaultName?.trim() || null
    const diskVaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    if (activeVaultName && !diskVaultNames.includes(activeVaultName)) {
      diskVaultNames.push(activeVaultName)
    }

    if (options?.mode === 'pending-only') {
      return {
        flushed: 0,
        pendingFlushed,
        dbCount: 0,
        diskCount: 0,
        skippedMissingScan: true,
        dbTotalCount: 0,
        skippedOtherVaultCount: 0,
        missingIds: [],
        failedIds: [],
        activeVaultName
      }
    }

    if (!activeVaultName && diskVaultNames.length === 0) {
      console.warn('[IncrementalSync][SessionFlush]', {
        phase: 'skip-missing-scan',
        reason: 'no-target-vault',
        pendingFlushed,
        dirtyBefore
      })
      return {
        flushed: 0,
        pendingFlushed,
        dbCount: 0,
        diskCount: 0,
        skippedMissingScan: true,
        dbTotalCount: 0,
        skippedOtherVaultCount: 0,
        missingIds: [],
        failedIds: [],
        activeVaultName
      }
    }

    // 全库会话（按伙伴列表可见的全部），不按活跃 vault 过滤
    const dbSessions = await this.sessionRepo.findAllSessions(-1)
    const diskSessions =
      diskVaultNames.length > 0
        ? await this.fileService.listSessionsAcrossVaults(diskVaultNames)
        : await this.fileService.listAllSessions(activeVaultName)
    const diskIds = new Set(diskSessions.map((s) => s.id))

    const missing = dbSessions.filter((s) => !diskIds.has(s.id))
    const missingIds = missing.map((s) => s.id)
    const failedIds: string[] = []
    const remappedVaultSamples: string[] = []
    let flushed = 0
    let skippedUnresolvedVault = 0

    for (const session of missing) {
      const targetVault = resolveSessionFlushTargetVault(
        session.vaultName,
        activeVaultName,
        diskVaultNames
      )
      if (!targetVault) {
        skippedUnresolvedVault++
        console.warn('[IncrementalSync][SessionFlush] skip-unresolved-vault', {
          sessionId: session.id,
          assistantId: session.assistantId ?? null,
          vaultName: session.vaultName ?? null
        })
        continue
      }
      const remapped =
        Boolean(session.vaultName?.trim()) &&
        session.vaultName !== 'default' &&
        session.vaultName !== targetVault
      if (remapped) {
        remappedVaultSamples.push(`${session.id}:${session.vaultName}->${targetVault}`)
      }
      try {
        await this.persistence.flushNow(session.id, { vaultName: targetVault })
        flushed++
        console.warn('[IncrementalSync][SessionFlush] wrote-missing-json', {
          sessionId: session.id,
          assistantId: session.assistantId ?? null,
          sessionVaultName: session.vaultName ?? null,
          targetVault,
          remapped,
          title: session.title ?? null
        })
      } catch (e) {
        failedIds.push(session.id)
        console.warn('[IncrementalSync][SessionFlush] write-missing-json-failed', {
          sessionId: session.id,
          assistantId: session.assistantId ?? null,
          sessionVaultName: session.vaultName ?? null,
          targetVault,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    }

    const assistantIdSamples = [...new Set(missing.map((s) => s.assistantId ?? '(null)'))].slice(
      0,
      12
    )

    console.warn('[IncrementalSync][SessionFlush]', {
      phase: 'summary',
      activeVaultName,
      diskVaultNames,
      dirtyBefore,
      pendingFlushed,
      dbTotalCount: dbSessions.length,
      dbCount: dbSessions.length,
      diskCount: diskSessions.length,
      missingCount: missingIds.length,
      flushed,
      failedCount: failedIds.length,
      skippedUnresolvedVault,
      skippedOtherVaultCount: skippedUnresolvedVault,
      assistantIdSamples,
      remappedVaultSamples: remappedVaultSamples.slice(0, 8),
      missingIdSamples: missingIds.slice(0, 12),
      failedIdSamples: failedIds.slice(0, 12),
      diskIdSamples: diskSessions.map((s) => s.id).slice(0, 8)
    })

    return {
      flushed,
      pendingFlushed,
      dbCount: dbSessions.length,
      diskCount: diskSessions.length,
      skippedMissingScan: false,
      dbTotalCount: dbSessions.length,
      skippedOtherVaultCount: skippedUnresolvedVault,
      missingIds,
      failedIds,
      activeVaultName
    }
  }

  /**
   * 把「盘上有、库中无」的会话灌进 SQLite。
   * 按唯一 sessionId 比较（跨 vault 同 ID 多份 JSON 只算一条），避免 fileCount>dbCount 误判导致每次全量 upsert。
   */
  async hydrateSessionsFromDiskIfNeeded(options?: {
    activeVaultName?: string | null
    diskVaultNames?: string[] | null
    maxSessionJsonReadBytes?: number
    /** @deprecated 不再触发全量 upsert；保留参数以免调用方报错 */
    force?: boolean
  }): Promise<{
    hydrated: boolean
    reason: string
    dbCount: number
    diskCount: number
    missingCount: number
  }> {
    const activeVaultName = options?.activeVaultName?.trim() || undefined
    const diskVaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    if (activeVaultName && !diskVaultNames.includes(activeVaultName)) {
      diskVaultNames.push(activeVaultName)
    }

    if (diskVaultNames.length === 0 && !activeVaultName) {
      return {
        hydrated: false,
        reason: 'no-vault-scope',
        dbCount: 0,
        diskCount: 0,
        missingCount: 0
      }
    }

    const dbSessions = await this.sessionRepo.findAllSessions(-1)
    const diskSessions =
      diskVaultNames.length > 0
        ? await this.fileService.listSessionsAcrossVaults(diskVaultNames)
        : await this.fileService.listAllSessions(activeVaultName)
    const dbIds = new Set(dbSessions.map((s) => s.id))
    const dbCount = dbSessions.length
    const diskCount = diskSessions.length

    // 每个 id 只取一份（优先活跃 vault）
    const missingById = new Map<string, { id: string; vaultName?: string }>()
    for (const file of diskSessions) {
      if (dbIds.has(file.id)) continue
      const vaultName = 'vaultName' in file ? file.vaultName : undefined
      const existing = missingById.get(file.id)
      if (!existing) {
        missingById.set(file.id, { id: file.id, vaultName })
        continue
      }
      if (
        activeVaultName &&
        vaultName === activeVaultName &&
        existing.vaultName !== activeVaultName
      ) {
        missingById.set(file.id, { id: file.id, vaultName })
      }
    }
    const missing = [...missingById.values()]
    const missingCount = missing.length

    console.warn('[IncrementalSync][SessionHydrate] check', {
      force: Boolean(options?.force),
      dbCount,
      diskCount,
      uniqueDiskIds: new Set(diskSessions.map((s) => s.id)).size,
      missingCount,
      diskVaultCount: diskVaultNames.length,
      activeVaultName: activeVaultName ?? null
    })

    if (missingCount === 0) {
      return { hydrated: false, reason: 'db-caught-up', dbCount, diskCount, missingCount: 0 }
    }

    const maxBytes = options?.maxSessionJsonReadBytes
    let upserted = 0
    let skipped = 0
    for (const item of missing) {
      try {
        if (maxBytes != null) {
          const byteSize = await this.fileService.getSessionFileByteSize(item.id, item.vaultName)
          if (byteSize != null && byteSize > maxBytes) {
            skipped++
            continue
          }
        }
        const sessionData = await this.fileService.readSession(item.id, item.vaultName)
        if (sessionData) {
          await this.sessionRepo.upsertAggregate(sessionData)
          upserted++
        } else {
          skipped++
        }
      } catch (e) {
        skipped++
        console.warn('[IncrementalSync][SessionHydrate] upsert-failed', {
          sessionId: item.id,
          vaultName: item.vaultName ?? null,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    }

    const afterDb = (await this.sessionRepo.findAllSessions(-1)).length
    console.warn('[IncrementalSync][SessionHydrate] done', {
      dbCountBefore: dbCount,
      diskCount,
      missingCount,
      upserted,
      skipped,
      dbCountAfter: afterDb
    })
    return {
      hydrated: upserted > 0,
      reason: 'missing-ids',
      dbCount: afterDb,
      diskCount,
      missingCount
    }
  }

  /**
   * 将指定会话 JSON 灌入 SQLite（用于同步下载后的定点水合，避免全库 fullScan）。
   */
  async importSessionsFromDisk(
    refs: ReadonlyArray<{ sessionId: string; vaultName?: string | null }>,
    options?: { maxSessionJsonReadBytes?: number }
  ): Promise<number> {
    const maxBytes = options?.maxSessionJsonReadBytes
    let imported = 0
    for (const ref of refs) {
      try {
        if (maxBytes != null) {
          const byteSize = await this.fileService.getSessionFileByteSize(
            ref.sessionId,
            ref.vaultName
          )
          if (byteSize != null && byteSize > maxBytes) continue
        }
        await this.syncService.syncSessionFile(ref.sessionId, ref.vaultName)
        imported++
      } catch (e) {
        console.warn('[SessionManager] importSessionsFromDisk failed', {
          sessionId: ref.sessionId,
          vaultName: ref.vaultName ?? null,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    }
    return imported
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

  /**
   * 冷启动 reconcile：mtime 比对后仅灌入缺失/更新的会话，并清理已扫 vault 幽灵。
   */
  async reconcileFromDisks(
    options?: import('../vault/disk-resync.types').DiskResyncOptions
  ): Promise<void> {
    try {
      await this.persistence.flushPending()
    } catch (e) {
      console.warn('[SessionManager] flushPending before reconcile failed:', e)
    }
    const preserve = new Set<string>([
      ...this.persistence.getDirtySessionIds(),
      ...(options?.preserveSessionIds ?? [])
    ])
    await this.syncService.reconcileFromDisks({
      ...options,
      preserveSessionIds: preserve.size > 0 ? preserve : options?.preserveSessionIds
    })
  }
}
