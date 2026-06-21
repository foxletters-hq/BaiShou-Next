import { AssistantRepository, InsertAssistantInput, UpdateAssistantInput } from '@baishou/database'
import {
  normalizePersistedAvatarPath,
  normalizeAssistantAvatarPath,
  normalizeAssistantKind,
  isBuiltinAssistantAvatarPath,
  isDefaultAssistantAvatarPath
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
import type { DiskResyncOptions } from '../sync/disk-resync.types'

/**
 * AI 角色身份卡存储漫游总代理。
 * 防止 SQLite 脱网数据变孤岛，全量接入单向 SSOT 管线拦截体系。
 */
export class AssistantManagerService {
  constructor(
    private readonly repo: AssistantRepository,
    private readonly fileService: AssistantFileService,
    private readonly attachmentManager: IAttachmentManager
  ) {}

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

  private async persistAssistantSnapshot(id: string): Promise<void> {
    const full = await this.repo.findById(id)
    if (!full) return
    const snapshot = {
      ...full,
      avatarPath: toPersistedAssistantAvatarPath(full.avatarPath),
      assistantKind: normalizeAssistantKind(full.assistantKind),
      sortOrder: full.sortOrder ?? 0
    }
    await this.fileService.writeAssistant(id, snapshot)
  }

  async create(input: InsertAssistantInput): Promise<void> {
    await this.processAvatarInput(input)
    if (input.sortOrder == null) {
      const all = await this.repo.findAll()
      input.sortOrder = all.reduce((max, a) => Math.max(max, a.sortOrder ?? 0), -1) + 1
    }
    await this.repo.create(input)
    await this.persistAssistantSnapshot(input.id)
    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${input.id}` },
      reason: 'assistant-create'
    })
  }

  async update(id: string, input: UpdateAssistantInput): Promise<void> {
    await this.processAvatarInput(input)
    await this.repo.update(id, input)
    await this.persistAssistantSnapshot(id)
    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${id}` },
      reason: 'assistant-update'
    })
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
    await this.fileService.deleteAssistant(id)
    emitDomainMutation({
      domain: 'settings',
      action: 'update',
      meta: { key: `assistant_${id}` },
      reason: 'assistant-delete'
    })
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.repo.togglePin(id, isPinned)
    await this.persistAssistantSnapshot(id)
  }

  async reorderAssistants(orderedIds: string[]): Promise<void> {
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index]!
      await this.repo.update(id, { sortOrder: index })
      await this.persistAssistantSnapshot(id)
    }
  }

  // SQLite 是热缓存，当前工作区可见性以 Assistants 目录为准
  async findAll() {
    const items = await this.repo.findAll()
    const fileIds = new Set((await this.fileService.listAllAssistants()).map((f) => f.id))
    return Promise.all(items.filter((i) => fileIds.has(i.id)).map((i) => this.mapAvatarOutput(i)))
  }

  async findById(id: string) {
    const item = await this.repo.findById(id)
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

    const fromDb = await this.repo.findById(input.id)
    if (fromDb) {
      await this.persistAssistantSnapshot(input.id)
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

  /**
   * 启动拉取与云盘恢复阶段的调用
   */
  async fullResyncFromDisks(_options?: DiskResyncOptions): Promise<void> {
    const allFiles = await this.fileService.listAllAssistants()
    const allDb = await this.repo.findAll()

    for (const f of allFiles) {
      const raw = await this.fileService.readAssistant(f.id)
      const data = normalizeDiskAssistantRecord(raw)
      if (!data?.id || typeof data.name !== 'string') {
        continue
      }

      // JSON.parse turns Date into ISO string, needs to transform to Date object
      // Otherwise Drizzle SQLiteTimestamp.mapToDriverValue will raise TypeError: value.getTime is not a function
      if (data.createdAt != null) data.createdAt = new Date(data.createdAt)
      if (data.updatedAt != null) data.updatedAt = new Date(data.updatedAt)
      if (data.avatarPath != null) {
        data.avatarPath =
          normalizePersistedAvatarPath(data.avatarPath) ??
          normalizeAssistantAvatarPath(data.avatarPath)
      }

      const existing = await this.repo.findById(f.id)
      if (existing) {
        if (!shouldApplyDiskAssistantRecord(data.updatedAt, existing.updatedAt)) {
          continue
        }
        await this.repo.update(f.id, pickDefinedAssistantUpdate(data) as UpdateAssistantInput)
      } else {
        await this.repo.create(data as InsertAssistantInput)
      }
    }

    const fileIds = new Set(allFiles.map((f) => f.id))
    for (const dbRecord of allDb) {
      if (!fileIds.has(dbRecord.id)) {
        await this.repo.delete(dbRecord.id)
      }
    }
  }
}
