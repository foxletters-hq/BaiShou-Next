import { AssistantRepository, InsertAssistantInput, UpdateAssistantInput } from '@baishou/database/src/repositories/assistant.repository';
import { AssistantFileService } from './assistant-file.service';
import { IAttachmentManager } from '../attachments/attachment-manager.types';

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
    if (input.avatarPath && input.avatarPath.trim().length > 0) {
      if (!input.avatarPath.startsWith('avatars/')) {
        input.avatarPath = await this.attachmentManager.importAvatar(input.avatarPath, 'agent');
      }
    }
  }

  private async mapAvatarOutput<T extends { avatarPath: string | null }>(item: T): Promise<T> {
    if (item.avatarPath && item.avatarPath.startsWith('avatars/')) {
        item.avatarPath = await this.attachmentManager.resolveAvatarPath(item.avatarPath);
    }
    return item;
  }

  async create(input: InsertAssistantInput): Promise<void> {
      await this.processAvatarInput(input);
      await this.repo.create(input);
      // 后挂抽样备份流
      const full = await this.repo.findById(input.id);
      if (full) await this.fileService.writeAssistant(input.id, full);
  }

  async update(id: string, input: UpdateAssistantInput): Promise<void> {
      await this.processAvatarInput(input);
      await this.repo.update(id, input);
      const full = await this.repo.findById(id);
      if (full) await this.fileService.writeAssistant(id, full);
  }

  async delete(id: string): Promise<void> {
      await this.repo.delete(id);
      await this.fileService.deleteAssistant(id);
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
      await this.repo.togglePin(id, isPinned);
      const full = await this.repo.findById(id);
      if (full) await this.fileService.writeAssistant(id, full);
  }

  // Queries directly proxy to db since they are identical and cached
  async findAll() {
      const items = await this.repo.findAll();
      return Promise.all(items.map(i => this.mapAvatarOutput(i)));
  }

  async findById(id: string) {
      const item = await this.repo.findById(id);
      if (item) return this.mapAvatarOutput(item);
      return item;
  }

  /**
   * 启动拉取与云盘恢复阶段的调用
   */
  async fullResyncFromDisks(): Promise<void> {
      const allFiles = await this.fileService.listAllAssistants();
      const allDb = await this.repo.findAll();

      for (const f of allFiles) {
          const data = await this.fileService.readAssistant(f.id);
          if (data) {
             const existing = await this.repo.findById(f.id);
             if (existing) {
                // Ignore parsing type mismatch due to quick schema update, we pass data via standard flow
                await this.repo.update(f.id, data);
             } else {
                await this.repo.create(data);
             }
          }
      }

      const fileIds = new Set(allFiles.map(f => f.id));
      for (const dbRecord of allDb) {
         if (!fileIds.has(dbRecord.id)) {
            await this.repo.delete(dbRecord.id);
         }
      }
  }
}
