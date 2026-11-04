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
  logger,
  type AssistantKind
} from '@baishou/shared'
import * as path from '../fs/path.util'
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

  /**
   * 列出所有可从其他小窝迁入当前小窝的心智伙伴。
   * 自动排除当前小窝，整合 SQLite 与磁盘文件中的数据，并附带历史会话数统计。
   */
  async listImportableAssistantsAcrossVaults(options?: {
    currentVaultId?: string | null
    allVaults?: Array<{ id: string; name: string }>
  }): Promise<ImportableAssistantItem[]> {
    const currentVaultId = this.tryVaultId(options?.currentVaultId)
    const vaultNameById = new Map<string, string>()
    const vaultIdByName = new Map<string, string>()

    if (options?.allVaults) {
      for (const v of options.allVaults) {
        if (v.id) vaultNameById.set(v.id, v.name)
        if (v.name) vaultIdByName.set(v.name, v.id)
      }
    }

    // 1. 获取 SQLite 中所有非当前小窝的伙伴
    const allDbAssistants = await this.repo.findAllAcrossVaults()
    const candidates = new Map<string, any>() // key: `${vaultId}_${assistantId}`

    for (const item of allDbAssistants) {
      if (currentVaultId && item.vaultId === currentVaultId) continue
      const key = `${item.vaultId}_${item.id}`
      candidates.set(key, item)
    }

    // 2. 补充磁盘上未入库或新同步的其他小窝伙伴
    if (options?.allVaults) {
      const otherVaultNames = options.allVaults
        .filter((v) => !currentVaultId || v.id !== currentVaultId)
        .map((v) => v.name)
      const diskFiles =
        (await this.fileService.listAssistantsAcrossVaults(otherVaultNames).catch(() => [])) || []

      for (const diskItem of diskFiles) {
        const vaultId =
          vaultIdByName.get(diskItem.vaultName) || deriveLegacyVaultId(diskItem.vaultName)
        if (currentVaultId && vaultId === currentVaultId) continue
        const key = `${vaultId}_${diskItem.id}`
        if (!candidates.has(key)) {
          const raw = await this.fileService.readAssistant(diskItem.id, diskItem.vaultName)
          const normalized = normalizeDiskAssistantRecord(raw)
          if (normalized?.id && normalized.name) {
            candidates.set(key, { ...normalized, vaultId })
          }
        }
      }
    }

    // 3. 构建结果列表并统计各伙伴在源小窝的会话数
    const results: ImportableAssistantItem[] = []
    for (const item of candidates.values()) {
      const sourceVaultId = item.vaultId
      const sourceVaultName =
        vaultNameById.get(sourceVaultId) ||
        (sourceVaultId.startsWith('vlt_') ? 'Personal' : sourceVaultId)
      const sessionCount = await this.repo.countSessionsByAssistant(item.id, sourceVaultId)

      results.push({
        id: item.id,
        name: item.name,
        emoji: item.emoji || '✨',
        avatarPath: item.avatarPath
          ? (toPersistedAssistantAvatarPath(item.avatarPath) ?? null)
          : null,
        description: item.description || null,
        systemPrompt: item.systemPrompt || null,
        customSystemPrompt: item.customSystemPrompt || null,
        isDefault: Boolean(item.isDefault),
        assistantKind: normalizeAssistantKind(item.assistantKind),
        sortOrder: item.sortOrder ?? 0,
        sourceVaultId,
        sourceVaultName,
        sessionCount
      })
    }

    return results
  }

  /**
   * 将其他小窝的心智伙伴批量迁入当前小窝。
   * - 解决默认伙伴冲突：若源伙伴 ID 为 latte 且目标小窝已有系统 latte，自动转生为全新自定义伙伴 ID，不覆盖现有 latte；
   * - 物理拷贝头像资源附件；
   * - 支持连带历史对话会话文件与记录一同迁移。
   */
  async importAssistantsFromOtherVaults(
    options: ImportAssistantsOptions
  ): Promise<ImportAssistantsResult> {
    const targetVaultId = this.requireVaultId(options.targetVaultId)
    const targetVaultName = options.targetVaultName?.trim() || 'Personal'
    const fileSystem = this.fileService.getFileSystem()
    const pathProvider = this.fileService.getPathProvider()

    const targetVaultDir = await pathProvider.getVaultDirectory(targetVaultName)
    const targetAssistantsDir = path.join(targetVaultDir, 'Assistants')
    const targetAttachmentsDir = path.join(targetVaultDir, 'Attachments')
    const targetSessionsDir = path.join(targetVaultDir, 'Sessions')

    await fileSystem.mkdir(targetAssistantsDir, { recursive: true })
    await fileSystem.mkdir(targetAttachmentsDir, { recursive: true })
    if (options.includeSessions) {
      await fileSystem.mkdir(targetSessionsDir, { recursive: true })
    }

    const targetLatte = await this.repo.findById('latte', targetVaultId)
    const result: ImportAssistantsResult = {
      importedAssistantsCount: 0,
      importedSessionsCount: 0,
      createdAssistantIds: []
    }

    for (const selectedItem of options.selected) {
      const { assistantId, sourceVaultId, sourceVaultName } = selectedItem
      let sourceAssistant = await this.repo.findById(assistantId, sourceVaultId)
      if (!sourceAssistant) {
        const raw = await this.fileService.readAssistant(assistantId, sourceVaultName)
        sourceAssistant = normalizeDiskAssistantRecord(raw) as any
      }

      if (!sourceAssistant) {
        logger.warn('[AssistantManager] 迁入跳过：源伙伴不存在', selectedItem)
        continue
      }

      // 1. 计算目标 ID 与属性（避免冲突）
      let targetId = assistantId
      let finalIsDefault = false
      let finalKind: AssistantKind = normalizeAssistantKind(sourceAssistant.assistantKind)

      if (assistantId === 'latte') {
        if (targetLatte) {
          // 目标已有系统 latte，源 latte 转生为独立自定义伙伴
          targetId = `ast_migrated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          finalIsDefault = false
        } else {
          targetId = 'latte'
          finalIsDefault = true
        }
      } else {
        const existing = await this.repo.findById(assistantId, targetVaultId)
        if (existing) {
          targetId = `ast_migrated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        } else {
          targetId = assistantId
        }
        finalIsDefault = false
      }

      // 2. 头像物理拷贝
      let finalAvatarPath = sourceAssistant.avatarPath ?? null
      if (
        finalAvatarPath &&
        typeof finalAvatarPath === 'string' &&
        finalAvatarPath.startsWith('avatars/')
      ) {
        try {
          const srcVaultDir = await pathProvider.getVaultDirectory(sourceVaultName)
          const srcAvatarFile = path.join(srcVaultDir, 'Attachments', finalAvatarPath)
          const destAvatarFile = path.join(targetAttachmentsDir, finalAvatarPath)

          if (await fileSystem.exists(srcAvatarFile)) {
            await fileSystem.mkdir(path.dirname(destAvatarFile), { recursive: true })
            if (!(await fileSystem.exists(destAvatarFile))) {
              await fileSystem.copyFile(srcAvatarFile, destAvatarFile)
            }
          }
        } catch (copyErr) {
          logger.warn('[AssistantManager] 迁入伙伴头像复制失败，保留路径引用:', copyErr as Error)
        }
      }

      // 3. 入库与写入目标 Assistants/{targetId}.json
      const persistedAvatar = finalAvatarPath
        ? toPersistedAssistantAvatarPath(finalAvatarPath)
        : undefined

      const insertData: InsertAssistantInput = {
        id: targetId,
        vaultId: targetVaultId,
        name: sourceAssistant.name,
        emoji: sourceAssistant.emoji || '✨',
        description: sourceAssistant.description ?? undefined,
        avatarPath: persistedAvatar ?? undefined,
        systemPrompt: sourceAssistant.systemPrompt ?? undefined,
        customSystemPrompt: sourceAssistant.customSystemPrompt ?? undefined,
        isDefault: finalIsDefault,
        isPinned: Boolean(sourceAssistant.isPinned),
        contextWindow: sourceAssistant.contextWindow ?? undefined,
        providerId: sourceAssistant.providerId ?? undefined,
        modelId: sourceAssistant.modelId ?? undefined,
        compressTokenThreshold: sourceAssistant.compressTokenThreshold ?? undefined,
        compressKeepTurns: sourceAssistant.compressKeepTurns ?? undefined,
        assistantKind: finalKind,
        sortOrder: sourceAssistant.sortOrder ?? 0
      }

      await this.repo.create(insertData)
      await this.fileService.writeAssistant(
        targetId,
        {
          ...insertData,
          isDefault: finalIsDefault,
          assistantKind: finalKind
        },
        targetVaultName
      )

      result.importedAssistantsCount++
      result.createdAssistantIds.push(targetId)

      // 4. 若勾选迁移会话
      if (options.includeSessions) {
        try {
          const srcVaultDir = await pathProvider.getVaultDirectory(sourceVaultName)
          const srcSessionsDir = path.join(srcVaultDir, 'Sessions')

          if (await fileSystem.exists(srcSessionsDir)) {
            const sessionFiles = await fileSystem.readdir(srcSessionsDir).catch(() => [])

            for (const file of sessionFiles) {
              if (!file.endsWith('.json')) continue
              const srcSessionPath = path.join(srcSessionsDir, file)
              try {
                const rawContent = await fileSystem.readFile(srcSessionPath, 'utf8')
                const parsed = JSON.parse(rawContent)
                const sess = parsed?.session ?? parsed
                const currentSessionAssistantId = sess?.assistantId

                // 匹配该伙伴的会话（兼容历史 default 与原 assistantId）
                const isMatch =
                  currentSessionAssistantId === assistantId ||
                  (assistantId === 'latte' &&
                    (currentSessionAssistantId === 'default' || !currentSessionAssistantId))

                if (!isMatch) continue

                // 为迁入生成目标 Session ID，避免跨小窝同名冲突
                const originalSessionId = (sess?.id || file.replace(/\.json$/i, '')).trim()
                const destFileStandardPath = path.join(
                  targetSessionsDir,
                  `${originalSessionId}.json`
                )
                const idConflict = await fileSystem.exists(destFileStandardPath)
                const newSessionId = idConflict
                  ? `sess_migrated_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                  : originalSessionId

                // 更新会话属性
                if (parsed.session && typeof parsed.session === 'object') {
                  parsed.session.id = newSessionId
                  parsed.session.vaultId = targetVaultId
                  parsed.session.vaultName = targetVaultName
                  parsed.session.assistantId = targetId
                }
                parsed.id = newSessionId
                parsed.vaultId = targetVaultId
                parsed.vaultName = targetVaultName
                parsed.assistantId = targetId

                const destPath = path.join(targetSessionsDir, `${newSessionId}.json`)
                await fileSystem.writeFile(destPath, JSON.stringify(parsed, null, 2), 'utf8')

                if (options.sessionRepo) {
                  await options.sessionRepo.upsertSession({
                    id: newSessionId,
                    title: sess?.title || '新对话',
                    vaultId: targetVaultId,
                    assistantId: targetId,
                    systemPrompt: sess?.systemPrompt,
                    providerId: sess?.providerId || 'default',
                    modelId: sess?.modelId || 'default'
                  })
                }

                result.importedSessionsCount++
              } catch (sessionErr) {
                logger.warn(`[AssistantManager] 迁入会话 ${file} 失败:`, sessionErr as Error)
              }
            }
          }
        } catch (sessMigrateErr) {
          logger.warn('[AssistantManager] 扫描源会话目录失败:', sessMigrateErr as Error)
        }
      }
    }

    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: 'assistants_imported' },
      reason: 'assistant-import'
    })

    return result
  }
}

export interface ImportableAssistantItem {
  id: string
  name: string
  emoji: string
  avatarPath: string | null
  description: string | null
  systemPrompt: string | null
  customSystemPrompt: string | null
  isDefault: boolean
  assistantKind?: AssistantKind | null
  sortOrder?: number
  sourceVaultId: string
  sourceVaultName: string
  sessionCount: number
}

export interface ImportAssistantsOptions {
  targetVaultId?: string | null
  targetVaultName?: string | null
  selected: Array<{
    assistantId: string
    sourceVaultId: string
    sourceVaultName: string
  }>
  includeSessions?: boolean
  sessionRepo?: {
    upsertSession(input: any): Promise<void>
  }
}

export interface ImportAssistantsResult {
  importedAssistantsCount: number
  importedSessionsCount: number
  createdAssistantIds: string[]
}
