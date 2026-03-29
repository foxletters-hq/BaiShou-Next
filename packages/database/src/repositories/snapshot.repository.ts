import { AppDatabase } from '../types';
import { compressionSnapshotsTable } from '../schema/compression-snapshots';
import { eq, desc } from 'drizzle-orm';

export interface Snapshot {
  id: number;
  sessionId: string;
  summaryText: string;
  coveredUpToMessageId: number;
  messageCount: number;
  tokenCount: number;
  createdAt: Date;
}

export class SnapshotRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * 写入/覆盖某个会话的历史压缩提纲
   */
  async appendSnapshot(params: Omit<Snapshot, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(compressionSnapshotsTable).values({
      sessionId: params.sessionId as unknown as number, // 历史架构 schema 用了 integer 但是外系统使用 uuid string，此处如果是强转先适配
      summaryText: params.summaryText,
      coveredUpToMessageId: params.coveredUpToMessageId,
      messageCount: params.messageCount,
      tokenCount: params.tokenCount,
      createdAt: new Date()
    });
  }

  /**
   * 取得指定会话最近的前情提要快照
   */
  async getLatestSnapshot(sessionId: string): Promise<Snapshot | null> {
    const result = await this.db.select()
      .from(compressionSnapshotsTable)
      .where(eq(compressionSnapshotsTable.sessionId, sessionId as unknown as number))
      .orderBy(desc(compressionSnapshotsTable.createdAt))
      .limit(1)
      .get();
      
    if (!result) return null;
    
    return {
      id: result.id,
      sessionId: result.sessionId.toString(),
      summaryText: result.summaryText,
      coveredUpToMessageId: result.coveredUpToMessageId,
      messageCount: result.messageCount,
      tokenCount: result.tokenCount,
      createdAt: result.createdAt,
    };
  }
}
