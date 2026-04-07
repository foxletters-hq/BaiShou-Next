import { AppDatabase } from '../types';
import { compressionSnapshotsTable } from '../schema/compression-snapshots';
import { eq, desc } from 'drizzle-orm';

export interface Snapshot {
  id: number;
  sessionId: string;
  summaryText: string;
  coveredUpToMessageId: string;
  messageCount: number;
  tokenCount: number | null;
  createdAt: Date;
}

export class SnapshotRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * 写入一条会话压缩快照（追加，不覆盖旧快照）
   * 对标原版 Flutter `appendSnapshot()`
   */
  async appendSnapshot(params: Omit<Snapshot, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(compressionSnapshotsTable).values({
      sessionId: params.sessionId,            // TEXT UUID，直接存储，无需强转
      summaryText: params.summaryText,
      coveredUpToMessageId: params.coveredUpToMessageId, // TEXT UUID
      messageCount: params.messageCount,
      tokenCount: params.tokenCount ?? null,
      createdAt: new Date(),
    });
  }

  /**
   * 取得指定会话最近的前情提要快照
   * 对标原版 Flutter `getLatestSnapshot()`
   */
  async getLatestSnapshot(sessionId: string): Promise<Snapshot | null> {
    const result = await this.db
      .select()
      .from(compressionSnapshotsTable)
      .where(eq(compressionSnapshotsTable.sessionId, sessionId))
      .orderBy(desc(compressionSnapshotsTable.createdAt), desc(compressionSnapshotsTable.id))
      .limit(1)
      .get();

    if (!result) return null;

    return {
      id: result.id,
      sessionId: result.sessionId,
      summaryText: result.summaryText,
      coveredUpToMessageId: result.coveredUpToMessageId,
      messageCount: result.messageCount,
      tokenCount: result.tokenCount ?? null,
      createdAt: result.createdAt,
    };
  }
}
