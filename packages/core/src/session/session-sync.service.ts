import { SessionRepository } from '@baishou/database/src/repositories/session.repository';
import { SessionFileService } from './session-file.service';

export class SessionSyncService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly fileService: SessionFileService
  ) {}

  /**
   * 同步指定的 JSON Session 到 DB 影子表中。
   */
  async syncSessionFile(sessionId: string): Promise<void> {
    const fileContent = await this.fileService.readSession(sessionId);

    if (!fileContent) {
       // 该文件已被从别的端删除同步到本地（成了空气），我们需要从 DB 清除幽灵缓存
       // 注意 SessionRepository.deleteSessions 接收的是数组
       await this.sessionRepo.deleteSessions([sessionId]);
       return;
    }

    // JSON 解析出来后可能会把 Date 变成 string，我们在 upsertAggregate 内部统一恢复了它。
    await this.sessionRepo.upsertAggregate(fileContent);
  }

  /**
   * 在启动 WebDAV、全盘映射或主动校验时调用，重建 AI 会话记忆。
   */
  async fullScanArchives(): Promise<void> {
    const allFiles = await this.fileService.listAllSessions();
    const allDbSessions = await this.sessionRepo.findAllSessions();
    
    // 逆向覆写：将存在于 File 系统的数据全部更新倒入 SQLite 中（即使版本一样也无妨，或者将来做 modifiedTime 脏检）
    for (const f of allFiles) {
       const sessionData = await this.fileService.readSession(f.id);
       if (sessionData) {
           await this.sessionRepo.upsertAggregate(sessionData);
       }
    }
    
    // 顺向清理：SQLite 中存在但对应的实体文件已销毁（可能是被彻底孤立淘汰了）
    const fileIds = new Set(allFiles.map(f => f.id));
    const toDeleteIds: string[] = [];
    for (const dbRecord of allDbSessions) {
       if (!fileIds.has(dbRecord.id)) {
           toDeleteIds.push(dbRecord.id);
       }
    }
    if (toDeleteIds.length > 0) {
        await this.sessionRepo.deleteSessions(toDeleteIds);
    }
  }
}
