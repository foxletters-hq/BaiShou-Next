import { SessionRepository, InsertSessionInput, InsertMessageInput, InsertPartInput } from '@baishou/database/src/repositories/session.repository';
import { SessionSyncService } from './session-sync.service';
import { SessionFileService } from './session-file.service';

/**
 * AI 会话总管
 * 拦截对 SQLite 的原子操作，并在每次修改后抽取 Aggregate 快照转存 JSON 从而获得跨端漫游能力。
 */
export class SessionManagerService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly fileService: SessionFileService,
    private readonly syncService: SessionSyncService
  ) {}

  async upsertSession(input: InsertSessionInput): Promise<void> {
    await this.sessionRepo.upsertSession(input);
    await this.flushSessionToDisk(input.id);
  }

  async insertMessageWithParts(message: InsertMessageInput, parts: InsertPartInput[]): Promise<void> {
    await this.sessionRepo.insertMessageWithParts(message, parts);
    await this.flushSessionToDisk(message.sessionId);
  }

  async updateTokenUsage(id: string, inputTokens: number, outputTokens: number, costMicros: number = 0): Promise<void> {
    await this.sessionRepo.updateTokenUsage(id, inputTokens, outputTokens, costMicros);
    await this.flushSessionToDisk(id);
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.sessionRepo.togglePin(id, isPinned);
    await this.flushSessionToDisk(id);
  }

  async deleteSessions(ids: string[]): Promise<void> {
    await this.sessionRepo.deleteSessions(ids);
    for (const id of ids) {
      await this.fileService.deleteSession(id);
    }
  }

  // ========== Query Readthrough ========== 

  async getMessagesBySession(sessionId: string, limit: number = 50) {
    return this.sessionRepo.getMessagesBySession(sessionId, limit);
  }

  async findAllSessions() {
    return this.sessionRepo.findAllSessions();
  }

  // ========== Internal Engine ==========

  /**
   * 核心漫游同步器：将 SQLite 这个纯状态机的热结果快照抽出，静默回写成为 SSOT 的 JSON 文件！
   * 外部的流式回答或业务组装方也可以手动调用它来归档会话。
   */
  public async flushSessionToDisk(sessionId: string): Promise<void> {
    const aggregate = await this.sessionRepo.getSessionAggregate(sessionId);
    if (aggregate) {
      await this.fileService.writeSession(sessionId, aggregate);
    }
  }

  /**
   * 对外暴露，当需要触发从云盘恢复数据时调用
   */
  async fullResyncFromDisks(): Promise<void> {
      await this.syncService.fullScanArchives();
  }
}
