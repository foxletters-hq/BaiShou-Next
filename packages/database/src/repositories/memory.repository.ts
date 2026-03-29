  
import { memoryEmbeddingsTable } from '../schema/vectors';
import { sql } from 'drizzle-orm';

export interface InsertMemoryPayload {
  embeddingId: string;
  sourceType: string;
  sourceId: string;
  groupId: string;
  chunkIndex: number;
  chunkText: string;
  metadataJson: string;
  embedding: number[];  // 浮点数组，将在入库前转换为 Buffer
  modelId: string;
}

export interface SearchMemoryParams {
  queryVector: number[]; // 待查相似度的查询向量
  limit?: number;
  modelId: string;       // 为了防止不同维度错乱，强制限制跨模型检索
  sourceType?: string;   // 可选的预过滤字段（比如 'diary'）
}

import { AppDatabase } from '../types';

export class MemoryRepository {
  constructor(private readonly database: AppDatabase) {}

  /**
   * 将浮点数组转化为 sqlite-vec 支持的 Float32 BLOB
   */
  private serializeVector(vector: number[]): Buffer {
    return Buffer.from(new Float32Array(vector).buffer);
  }

  /**
   * 落库向量记忆
   */
  async storeMemory(data: InsertMemoryPayload): Promise<void> {
    const vectorBuffer = this.serializeVector(data.embedding);

    await this.database.insert(memoryEmbeddingsTable).values({
      embeddingId: data.embeddingId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      groupId: data.groupId,
      chunkIndex: data.chunkIndex,
      chunkText: data.chunkText,
      metadataJson: data.metadataJson,
      embedding: vectorBuffer,
      dimension: data.embedding.length,
      modelId: data.modelId,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: [memoryEmbeddingsTable.embeddingId],
      set: {
        chunkText: data.chunkText,
        embedding: vectorBuffer,
        dimension: data.embedding.length,
        modelId: data.modelId,
        metadataJson: data.metadataJson,
      }
    });
  }

  /**
   * 在 SQLite 原表中执行 KNN 暴力语义计算查找相似 Top K。
   */
  async searchByVector(params: SearchMemoryParams): Promise<any[]> {
    const vectorBuffer = this.serializeVector(params.queryVector);
    const topK = params.limit ?? 5;

    // 构建非常基础的 WHERE 预过滤条件 (过滤模型防止维度报错)
    let whereCondition = sql`${memoryEmbeddingsTable.modelId} = ${params.modelId}`;
    
    if (params.sourceType) {
      whereCondition = sql`${whereCondition} AND ${memoryEmbeddingsTable.sourceType} = ${params.sourceType}`;
    }

    // 在 Drizzle 里，由于 vec_distance_cosine 不在其原生的函数体系内，我们需要写 Raw SQL
    return await this.database
      .select({
        id: memoryEmbeddingsTable.id,
        embeddingId: memoryEmbeddingsTable.embeddingId,
        sourceId: memoryEmbeddingsTable.sourceId,
        chunkText: memoryEmbeddingsTable.chunkText,
        distance: sql<number>`vec_distance_cosine(${memoryEmbeddingsTable.embedding}, ${vectorBuffer})`.as('distance')
      })
      .from(memoryEmbeddingsTable)
      .where(whereCondition)
      // 根据距离升序排列（越相似余弦距离越接近 0）
      .orderBy(sql`vec_distance_cosine(${memoryEmbeddingsTable.embedding}, ${vectorBuffer}) ASC`)
      .limit(topK);
  }
}
