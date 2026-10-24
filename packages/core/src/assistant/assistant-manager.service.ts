import { AssistantRepository, InsertAssistantInput, UpdateAssistantInput } from '@baishou/database'
import {
  normalizePersistedAvatarPath,
  normalizeAssistantAvatarPath,
  normalizeAssistantKind,
  isBuiltinAssistantAvatarPath,
  isDefaultAssistantAvatarPath,
  isAssistantCustomAvatar,
  extractAvatarsRelativeKey,
  deriveLegacyVaultId,
  isVaultId,
  isSystemLatteAssistantId,
  SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE,
  logger
} from '@baishou/shared'
import { AssistantFileService } from './assistant-file.service'
import { emitDomainMutation } from '../events'
import { IAttachmentManager } from '../attachments/attachment-manager.types'
import {
  pickDefinedAssistantUpdate,
  shouldApplyDiskAssistantRecord,
  toPersistedAssistantAvatarPath,
  normalizeDiskAssistantRecord
} from './assistant-persist.util'
import type { DiskResyncOptions } from '../vault/disk-resync.types'

export type AssistantVaultIdResolver = () => string | null | undefined

/**
 * 会话重绑后的落盘回调。
 * 单仓会话 JSON 是冷启动回灌 SQLite 的权威源，必须把 assistant_id 同步写回磁盘，
 * 否则下一次启动会把刚修好的绑定覆盖回旧值。
 */
export type AssistantSessionRebindPort = {
  onSessionsRebound?: (payload: {
    vaultId: string
    oldAssistantId: string
    newAssistantId: string
    sessionIds: string[]
  }) => Promise<void> | void
}

function normalizeVaultId(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  return isVaultId(value) ? value : deriveLegacyVaultId(value)
}

/**
 * AI 角色身份卡存储漫游总代理。
 * 防止 SQLite 脱网数据变孤岛，全量接入单向 SSOT 管线拦截体系。
 */
export class AssistantManagerService {
  constructor(
    private readonly repo: AssistantRepository,
    private readonly fileService: AssistantFileService,
    private readonly attachmentManager: IAttachmentManager,
    private readonly resolveVaultId?: AssistantVaultIdResolver,
    private readonly sessionRebindPort?: AssistantSessionRebindPort
  ) {}

  private requireVaultId(override?: string | null): string {
    const id = normalizeVaultId(override) ?? normalizeVaultId(this.resolveVaultId?.())
    if (!id) {
      throw new Error('AssistantManager: vault_id is required')
    }
    return id
  }

  private tryVaultId(override?: string | null): string | null {
    return normalizeVaultId(override) ?? normalizeVaultId(this.resolveVaultId?.())
  }

  private resolveVaultIdForName(vaultName: string, options?: DiskResyncOptions): string {
    const mapped = options?.vaultIdByName?.[vaultName]
    const fromMap = normalizeVaultId(mapped)
    if (fromMap) return fromMap
    return deriveLegacyVaultId(vaultName)
  }

  private async processAvatarInput(input: { avatarPath?: string | null }) {
    const raw = input.avatarPath?.trim()
    if (!raw) return
    if (isDefaultAssistantAvatarPath(raw) && !isBuiltinAssistantAvatarPath(raw)) {
      input.avatarPath = normalizeAssistantAvatarPath(raw)
      return
    }

    const persisted = normalizePersistedAvatarPath(raw)
    if (persisted?.startsWith('avatars/') || isBuiltinAssistantAvatarPath(persisted ?? '')) {
      input.avatarPath = persisted ?? normalizeAssistantAvatarPath(raw)
      return
    }

    input.avatarPath = await this.attachmentManager.importAvatar(raw, 'agent')
  }

  /** 将任意形态头像路径规范为可比较的持久化键 */
  private toComparableAvatarKey(avatarPath: string | null | undefined): string | null {
    if (!avatarPath) return null
    const normalized = normalizePersistedAvatarPath(avatarPath)
    if (!normalized) return null
    if (isBuiltinAssistantAvatarPath(normalized) || isDefaultAssistantAvatarPath(normalized)) {
      return normalizeAssistantAvatarPath(normalized)
    }
    if (normalized.startsWith('avatars/')) return normalized
    return extractAvatarsRelativeKey(normalized)
  }

  /**
   * 旧自定义头像无人再引用时删除磁盘文件（含桌面全局镜像）。
   * 内置头像跳过；仍被其他伙伴引用时跳过。
   */
  private async cleanupOrphanedCustomAvatar(
    oldAvatarPath: string | null | undefined,
    nextAvatarPath: string | null | undefined,
    options?: { excludeAssistantId?: string; vaultId?: string }
  ): Promise<void> {
    if (!isAssistantCustomAvatar(oldAvatarPath)) return
    const oldKey = this.toComparableAvatarKey(oldAvatarPath)
    if (!oldKey?.startsWith('avatars/')) return

    const nextKey = this.toComparableAvatarKey(nextAvatarPath)
    if (nextKey && nextKey === oldKey) return

    const vaultId = this.tryVaultId(options?.vaultId)
    const others = vaultId ? await this.repo.findAll(vaultId) : []
    const stillReferenced = others.some((item) => {
      if (options?.excludeAssistantId && item.id === options.excludeAssistantId) return false
      return this.toComparableAvatarKey(item.avatarPath) === oldKey
    })
    if (stillReferenced) return

    try {
      await this.attachmentManager.deleteAvatar(oldKey)
    } catch (e) {
      console.warn('[AssistantManager] Failed to delete replaced custom avatar:', oldKey, e)
    }
  }

  private async mapAvatarOutput<T extends { avatarPath: string | null }>(item: T): Promise<T> {
    if (item.avatarPath && item.avatarPath.startsWith('avatars/')) {
      try {
        item.avatarPath = await this.attachmentManager.resolveAvatarPath(item.avatarPath)
      } catch {
        // 文件尚未同步到位时保留相对路径，由 UI 层再解析
      }
    }
    return item
  }

  private async persistAssistantSnapshot(id: string, vaultId?: string | null): Promise<void> {
    const scoped = this.requireVaultId(vaultId)
    const full = await this.repo.findById(id, scoped)
    if (!full) return
    const { vaultId: _internalVaultId, ...cleanRecord } = full
    const snapshot = {
      ...cleanRecord,
      avatarPath: toPersistedAssistantAvatarPath(full.avatarPath),
      assistantKind: normalizeAssistantKind(full.assistantKind),
      sortOrder: full.sortOrder ?? 0
    }
    await this.fileService.writeAssistant(id, snapshot)
  }

  async create(input: InsertAssistantInput): Promise<void> {
    const vaultId = this.requireVaultId(input.vaultId)
    const withVault = { ...input, vaultId }
    await this.processAvatarInput(withVault)
    if (withVault.sortOrder == null) {
      const all = await this.repo.findAll(vaultId)
      withVault.sortOrder = all.reduce((max, a) => Math.max(max, a.sortOrder ?? 0), -1) + 1
    }
    await this.repo.create(withVault)
    await this.persistAssistantSnapshot(withVault.id, vaultId)
    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${withVault.id}` },
      reason: 'assistant-create'
    })
  }

  async update(id: string, input: UpdateAssistantInput): Promise<void> {
    const vaultId = this.requireVaultId()
    const previous = await this.repo.findById(id, vaultId)
    const previousAvatar = previous?.avatarPath ?? null
    const avatarChanging = input.avatarPath !== undefined

    await this.processAvatarInput(input)
    await this.repo.update(id, input, vaultId)
    await this.persistAssistantSnapshot(id, vaultId)

    if (avatarChanging) {
      await this.cleanupOrphanedCustomAvatar(previousAvatar, input.avatarPath ?? null, {
        excludeAssistantId: id,
        vaultId
      })
    }

    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${id}` },
      reason: 'assistant-update'
    })
  }

  async delete(id: string, vaultIdOverride?: string | null): Promise<void> {
    if (isSystemLatteAssistantId(id)) {
      throw new Error(SYSTEM_LATTE_ASSISTANT_CANNOT_DELETE)
    }
    const vaultId = this.requireVaultId(vaultIdOverride)
    const previous = await this.repo.findById(id, vaultId)
    const previousAvatar = previous?.avatarPath ?? null
    await this.repo.delete(id, vaultId)
    await this.fileService.deleteAssistant(id)
    await this.cleanupOrphanedCustomAvatar(previousAvatar, null, {
      excludeAssistantId: id,
      vaultId
    })
    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${id}` },
      reason: 'assistant-delete'
    })
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    const vaultId = this.requireVaultId()
    await this.repo.togglePin(id, isPinned, vaultId)
    await this.persistAssistantSnapshot(id, vaultId)
  }

  async reorderAssistants(orderedIds: string[]): Promise<void> {
    const vaultId = this.requireVaultId()
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index]!
      await this.repo.update(id, { sortOrder: index }, vaultId)
      await this.persistAssistantSnapshot(id, vaultId)
    }
  }

  // SQLite 是热缓存，当前工作区可见性以 Assistants 目录为准
  async findAll(vaultIdOverride?: string | null) {
    const vaultId = this.tryVaultId(vaultIdOverride)
    if (!vaultId) return []
    let items = await this.repo.findAll(vaultId)
    const fileIds = new Set((await this.fileService.listAllAssistants()).map((f) => f.id))
    const dbIds = new Set(items.map((i) => i.id))
    const missingFileIds = [...fileIds].filter((fileId) => !dbIds.has(fileId))

    if (missingFileIds.length > 0) {
      let hydratedAny = false
      for (const fileId of missingFileIds) {
        if (await this.upsertFromDiskFile(fileId, vaultId)) {
          hydratedAny = true
        }
      }
      if (hydratedAny) {
        items = await this.repo.findAll(vaultId)
      }
    }

    // 兜底：Assistants 目录一个文件都没有、但库里有记录时，先按库返回。
    // 常见于工作区目录未挂载 / 云盘尚未同步完成；否则 UI 会退回默认伙伴，
    // 连带把旧会话按 assistantId 过滤掉，看起来像聊天记录和名字都丢了。
    if (fileIds.size === 0 && items.length > 0) {
      logger.warn('[AssistantManager] assistants directory is empty; falling back to SQLite rows', {
        vaultId,
        count: items.length
      })
      return Promise.all(items.map((i) => this.mapAvatarOutput(i)))
    }

    return Promise.all(items.filter((i) => fileIds.has(i.id)).map((i) => this.mapAvatarOutput(i)))
  }

  async findById(id: string, vaultIdOverride?: string | null) {
    const vaultId = this.tryVaultId(vaultIdOverride)
    if (!vaultId) return undefined
    let item = await this.repo.findById(id, vaultId)
    if (!item) {
      const hydrated = await this.upsertFromDiskFile(id, vaultId)
      if (hydrated) {
        item = await this.repo.findById(id, vaultId)
      }
    }
    if (item) return this.mapAvatarOutput(item)
    return item
  }

  /** 将 SQLite 中的伙伴快照写入当前工作区 Assistants 目录（文件不存在时） */
  async syncToDisk(id: string): Promise<void> {
    const onDisk = await this.fileService.readAssistant(id)
    if (onDisk?.id) return
    await this.persistAssistantSnapshot(id)
  }

  /** 确保伙伴 JSON 存在于当前工作区磁盘（优先复用 DB，否则按输入写入） */
  async ensureDiskFromInput(input: InsertAssistantInput): Promise<void> {
    const onDisk = await this.fileService.readAssistant(input.id)
    if (onDisk?.id) return

    const vaultId = this.requireVaultId(input.vaultId)
    const fromDb = await this.repo.findById(input.id, vaultId)
    if (fromDb) {
      await this.persistAssistantSnapshot(input.id, vaultId)
      return
    }

    await this.processAvatarInput(input)
    const now = new Date()
    const snapshot = {
      ...input,
      emoji: input.emoji ?? null,
      description: input.description ?? null,
      avatarPath: toPersistedAssistantAvatarPath(input.avatarPath ?? null),
      systemPrompt: input.systemPrompt ?? null,
      customSystemPrompt: input.customSystemPrompt ?? null,
      isDefault: input.isDefault ?? false,
      isPinned: input.isPinned ?? false,
      contextWindow: input.contextWindow ?? null,
      providerId: input.providerId ?? null,
      modelId: input.modelId ?? null,
      compressTokenThreshold: input.compressTokenThreshold ?? null,
      compressKeepTurns: input.compressKeepTurns ?? null,
      assistantKind: normalizeAssistantKind(input.assistantKind),
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now
    }
    await this.fileService.writeAssistant(input.id, snapshot)
  }

  private async upsertFromDiskFile(
    fileId: string,
    vaultId: string,
    vaultName?: string | null
  ): Promise<boolean> {
    const raw = await this.fileService.readAssistant(fileId, vaultName)
    const data = normalizeDiskAssistantRecord(raw)
    if (!data?.id || typeof data.name !== 'string') {
      return false
    }

    if (data.createdAt != null) data.createdAt = new Date(data.createdAt)
    if (data.updatedAt != null) data.updatedAt = new Date(data.updatedAt)
    if (data.avatarPath != null) {
      data.avatarPath =
        normalizePersistedAvatarPath(data.avatarPath) ??
        normalizeAssistantAvatarPath(data.avatarPath)
    }

    const existing = await this.repo.findById(fileId, vaultId)
    if (existing) {
      if (!shouldApplyDiskAssistantRecord(data.updatedAt, existing.updatedAt)) {
        return true
      }
      await this.repo.update(
        fileId,
        pickDefinedAssistantUpdate(data) as UpdateAssistantInput,
        vaultId
      )
    } else {
      await this.repo.create({ ...(data as InsertAssistantInput), vaultId })
    }
    return true
  }

  /**
   * 启动拉取与云盘恢复阶段的调用。
   * 传入 diskVaultNames 时跨仓水合；ghost 清理仅限本仓（或已扫描仓）的行。
   */
  async fullResyncFromDisks(options?: DiskResyncOptions): Promise<void> {
    const vaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]

    if (vaultNames.length > 0) {
      const allFiles = await this.fileService.listAssistantsAcrossVaults(vaultNames)
      const scannedVaultIds = new Set<string>()

      if (allFiles.length === 0) {
        logger.warn(
          '[AssistantManager] cross-vault rescan found 0 assistant files; skip ghost cleanup',
          {
            diskVaultNames: vaultNames
          }
        )
      }

      for (const f of allFiles) {
        const vaultId = this.resolveVaultIdForName(f.vaultName, options)
        scannedVaultIds.add(vaultId)
        await this.upsertFromDiskFile(f.id, vaultId, f.vaultName)
      }

      for (const vaultId of scannedVaultIds) {
        const fileIds = new Set(
          allFiles
            .filter((f) => this.resolveVaultIdForName(f.vaultName, options) === vaultId)
            .map((f) => f.id)
        )
        const dbRows = await this.repo.findAll(vaultId)
        for (const dbRecord of dbRows) {
          if (!fileIds.has(dbRecord.id)) {
            await this.repo.delete(dbRecord.id, vaultId)
          }
        }
      }
      return
    }

    // 仅活跃仓：只清本仓幽灵，不再整表当活跃仓缓存
    const vaultId =
      normalizeVaultId(options?.activeVaultId) ??
      (options?.activeVaultName
        ? this.resolveVaultIdForName(options.activeVaultName, options)
        : this.tryVaultId())
    if (!vaultId) return

    const allFiles = await this.fileService.listAllAssistants()
    const allDb = await this.repo.findAll(vaultId)

    // 兜底：一个伙伴 JSON 都没扫到但库里有记录时，先判定为目录/挂载异常，禁止清库。
    if (allFiles.length === 0 && allDb.length > 0) {
      logger.warn(
        '[AssistantManager] active-vault rescan found 0 assistant files; skip ghost cleanup',
        { vaultId, dbCount: allDb.length }
      )
      return
    }

    for (const f of allFiles) {
      await this.upsertFromDiskFile(f.id, vaultId)
    }

    const fileIds = new Set(allFiles.map((f) => f.id))
    for (const dbRecord of allDb) {
      if (!fileIds.has(dbRecord.id)) {
        await this.repo.delete(dbRecord.id, vaultId)
      }
    }
  }

  /**
   * 将会话关联的助手 ID 批量重绑定（用于出厂默认助手升级为官方系统助手）。
   * 数据库改完后立即通过 port 把会话 JSON 落盘，避免冷启动回灌把绑定改回旧值。
   * 返回被改写的会话 ID；幂等，旧 ID 无会话时返回空数组。
   */
  async rebindSessionsAssistantId(
    oldId: string,
    newId: string,
    vaultId?: string | null
  ): Promise<string[]> {
    const scoped = this.requireVaultId(vaultId)
    const sessionIds = await this.repo.rebindAssistantSessions(oldId, newId, scoped)
    if (sessionIds.length === 0) return sessionIds

    try {
      await this.sessionRebindPort?.onSessionsRebound?.({
        vaultId: scoped,
        oldAssistantId: oldId,
        newAssistantId: newId,
        sessionIds
      })
    } catch (e) {
      logger.warn('[AssistantManager] 会话重绑后落盘失败（下次启动会再次自愈）:', {
        oldId,
        newId,
        vaultId: scoped,
        count: sessionIds.length,
        error: e instanceof Error ? e.message : String(e)
      })
    }

    logger.info('[AssistantManager] 历史会话伙伴绑定已迁移', {
      oldId,
      newId,
      vaultId: scoped,
      count: sessionIds.length
    })
    return sessionIds
  }
}
