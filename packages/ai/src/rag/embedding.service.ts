import { get_encoding } from 'tiktoken';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import { embed } from 'ai';
import { logger } from '@baishou/shared';


import { IEmbeddingConfig, IEmbeddingStorage, ChunkResult, MigrationProgress } from './embedding.types';

export class EmbeddingService {
  private static readonly MAX_CHUNK_TOKENS = 1024;
  private static readonly CHUNK_OVERLAP_TOKENS = 128;
  
  private isMigrating = false;

  constructor(
    private readonly config: IEmbeddingConfig,
    private readonly db: IEmbeddingStorage
  ) {}

  public get isConfigured(): boolean {
    const modelId = this.config.getGlobalEmbeddingModelId();
    const providerId = this.config.getGlobalEmbeddingProviderId();
    return Boolean(modelId && providerId);
  }

  /**
   * 按需检测底层向量引擎的维度以保证后续矢量比较计算
   */
  public async detectDimension(): Promise<number> {
    if (!this.isConfigured) return 0;
    
    const cachedDimension = this.config.getGlobalEmbeddingDimension();
    if (cachedDimension && cachedDimension > 0) return cachedDimension;

    try {
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();

      if (!provider) return 0;

      const model = provider.getEmbeddingModel(modelId);
      const { embedding } = await embed({
        model,
        value: 'hi'
      });
      const dimension = embedding.length;
      await this.config.setGlobalEmbeddingDimension(dimension);
      logger.debug(`EmbeddingService: Detected dimension ${dimension} (${modelId})`);
      return dimension;
    } catch (e: any) {
      logger.error('EmbeddingService: Dimension detection failed', { error: e });
      throw new Error(`连接或鉴权失败: ${e.message || String(e)}`);
    }
  }

  public async embedMessage(params: { messageId: string, sessionId: string, content: string }): Promise<void> {
    if (!this.isConfigured || !params.content.trim()) return;

    try {
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();
      if (!provider) return;

      const aiModel = provider.getEmbeddingModel(modelId);

      // 前置维度监测
      const currentDim = await this.detectDimension();
      if (currentDim > 0) {
        await this.db.initVectorIndex(currentDim);
      }

      const chunks = this.splitIntoChunks(params.content);

      for (const chunk of chunks) {
        await this.retryEmbed(async () => {
          const { embedding } = await embed({
            model: aiModel,
            value: chunk.text
          });

          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: 'chat',
            sourceId: params.messageId,
            groupId: params.sessionId,
            chunkIndex: chunk.index,
            chunkText: chunk.text,
            embedding: this.normalize(embedding),
            modelId: modelId
          });
        }, `embedMessage chunk ${chunk.index}`);
      }
    } catch (e) {
      logger.error('Embedding failed', { error: e });
    }
  }

  public async embedQuery(query: string): Promise<number[] | null> {
    if (!this.isConfigured) return null;
    try {
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();
      if (!provider) return null;

      const aiModel = provider.getEmbeddingModel(modelId);
      const { embedding } = await embed({
        model: aiModel,
        value: query
      });

      return this.normalize(embedding);
    } catch (e) {
      logger.error('Query embedding failed', { error: e });
      return null;
    }
  }

  public async updateMemoryChunk(params: { entry: any; newText: string; }): Promise<void> {
    if (!this.isConfigured || !params.newText.trim()) return;

    const modelId = this.config.getGlobalEmbeddingModelId();
    const provider = await this.config.getProviderInstance();
    if (!provider) return;

    const aiModel = provider.getEmbeddingModel(modelId);

    await this.retryEmbed(async () => {
      const { embedding } = await embed({
        model: aiModel,
        value: params.newText
      });

      await this.db.insertEmbedding({
        id: params.entry.embedding_id,
        sourceType: params.entry.source_type,
        sourceId: params.entry.source_id,
        groupId: params.entry.group_id,
        chunkIndex: params.entry.chunk_index,
        chunkText: params.newText,
        metadataJson: params.entry.metadata_json || '{}',
        embedding: this.normalize(embedding),
        modelId,
      });
    }, `updateMemoryChunk ${params.entry.embedding_id}`);
  }

  public async embedText(params: {
    text: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
    metadataJson?: string;
    sourceCreatedAt?: number;
    chunkPrefix?: string;
  }): Promise<void> {
    if (!this.isConfigured || !params.text.trim()) return;

    try {
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();
      if (!provider) return;

      const aiModel = provider.getEmbeddingModel(modelId);

      const currentDim = await this.detectDimension();
      if (currentDim > 0) {
        await this.db.initVectorIndex(currentDim);
      }

      const chunks = this.splitIntoChunks(params.text);
      
      const futures: Promise<void>[] = [];

      for (const chunk of chunks) {
        const embeddingInput = params.chunkPrefix ? `${params.chunkPrefix}${chunk.text}` : chunk.text;
        
        const future = this.retryEmbed(async () => {
          const { embedding } = await embed({
            model: aiModel,
            value: embeddingInput
          });

          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            groupId: params.groupId,
            chunkIndex: chunk.index,
            chunkText: embeddingInput,
            metadataJson: params.metadataJson || '{}',
            embedding: this.normalize(embedding),
            modelId,
            sourceCreatedAt: params.sourceCreatedAt
          });
        }, `embedText chunk ${chunk.index}`);

        futures.push(future);

        if (futures.length >= 3) {
          await Promise.all(futures);
          futures.length = 0;
        }
      }

      if (futures.length > 0) {
        await Promise.all(futures);
      }

    } catch(e) {
      logger.error('embedText failed', { error: e });
      throw e;
    }
  }
  
  public async reEmbedText(params: {
    text: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
    metadataJson?: string;
    sourceCreatedAt?: number;
    chunkPrefix?: string;
  }): Promise<void> {
    await this.db.deleteEmbeddingsBySource(params.sourceType, params.sourceId);
    await this.embedText(params);
  }

  public async reEmbedMessage(params: { messageId: string, sessionId: string, content: string }): Promise<void> {
    await this.db.deleteEmbeddingsBySource('chat', params.messageId);
    await this.embedMessage(params);
  }

  public async hasPendingMigration(): Promise<boolean> {
    return this.db.hasPendingMigration();
  }

  public async hasHeterogeneousEmbeddings(): Promise<boolean> {
    const currentGlobalModelId = this.config.getGlobalEmbeddingModelId();
    if (!currentGlobalModelId) return false;
    const count = await this.db.countHeterogeneousEmbeddings(currentGlobalModelId);
    return count > 0;
  }

  public async clearAllEmbeddings(): Promise<void> {
     await this.db.clearEmbeddings();
     await this.config.setGlobalEmbeddingDimension(0);
  }

  public async *migrateEmbeddings(): AsyncGenerator<MigrationProgress, void, unknown> {
    if (this.isMigrating) {
      yield { total: 0, completed: 0, status: '已经有迁移任务在运行' };
      return;
    }
    this.isMigrating = true;
    try {
      if (!this.isConfigured) {
        yield { total: 0, completed: 0, status: '嵌入模型未配置' };
        return;
      }
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();
      if (!provider) {
        yield { total: 0, completed: 0, status: '供应商未找到' };
        return;
      }

      const clientModel = provider.getEmbeddingModel(modelId);
      yield { total: 0, completed: 0, status: '正在备份元数据...' };
      const total = await this.db.createMigrationBackup();

      if (total === 0) {
        await this.db.dropMigrationBackup();
        yield { total: 0, completed: 0, status: '没有需要迁移的数据' };
        return;
      }

      yield { total, completed: 0, status: '正在检测新模型维度...' };
      let newDimension = 0;
      try {
        const { embedding } = await embed({ model: clientModel, value: 'hi' });
        newDimension = embedding.length;
      } catch (e) {
        logger.error('Dimension check failed during migration', { error: e });
      }

      if (newDimension <= 0) {
        yield { total, completed: 0, status: '新模型维度检测失败，迁移中止' };
        return;
      }

      await this.db.clearAndReinitEmbeddings(newDimension);
      await this.config.setGlobalEmbeddingDimension(newDimension);

      yield* this.doReEmbedFromBackup(clientModel, modelId, total);

    } finally {
      this.isMigrating = false;
    }
  }

  public async *continueMigration(): AsyncGenerator<MigrationProgress, void, unknown> {
    if (this.isMigrating) {
      yield { total: 0, completed: 0, status: '已经有迁移任务在运行' };
      return;
    }
    this.isMigrating = true;
    try {
      if (!this.isConfigured) {
        yield { total: 0, completed: 0, status: '嵌入模型未配置' };
        return;
      }
      const modelId = this.config.getGlobalEmbeddingModelId();
      const provider = await this.config.getProviderInstance();
      if (!provider) {
        yield { total: 0, completed: 0, status: '供应商未找到' };
        return;
      }

      const clientModel = provider.getEmbeddingModel(modelId);
      const remaining = await this.db.getUnmigratedCount();

      if (remaining === 0) {
        await this.db.dropMigrationBackup();
        yield { total: 0, completed: 0, status: '迁移已完成' };
        return;
      }

      yield* this.doReEmbedFromBackup(clientModel, modelId, remaining);

    } finally {
      this.isMigrating = false;
    }
  }

  private async *doReEmbedFromBackup(aiModel: any, modelId: string, total: number): AsyncGenerator<MigrationProgress, void, unknown> {
    yield { total, completed: 0, status: '开始重嵌入...' };

    const chunks = await this.db.getUnmigratedBackupChunks();
    let completed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        await this.retryEmbed(async () => {
          const { embedding } = await embed({
            model: aiModel,
            value: chunk.chunk_text
          });

          await this.db.insertEmbedding({
            id: chunk.embedding_id,
            sourceType: chunk.source_type,
            sourceId: chunk.source_id,
            groupId: chunk.group_id,
            chunkIndex: chunk.chunk_index,
            chunkText: chunk.chunk_text,
            metadataJson: chunk.metadata_json,
            embedding: this.normalize(embedding),
            modelId,
            sourceCreatedAt: chunk.source_created_at
          });

          await this.db.markBackupChunkMigrated(chunk.embedding_id);
        }, `migrate chunk ${chunk.embedding_id}`);
        completed++;
      } catch (e) {
        failed++;
        logger.error(`Migration failed for chunk ${chunk.embedding_id}`, { error: e });
      }

      yield {
        total,
        completed,
        failed,
        status: `迁移中 ${completed}/${total}${failed > 0 ? ` (失败 ${failed})` : ''}`
      };
    }

    const [allMigrated, noStale] = await this.db.verifyMigrationComplete(modelId);

    if (allMigrated && noStale) {
      await this.db.dropMigrationBackup();
      yield { total, completed, failed, status: `迁移完成 ✅ ${completed}/${total}` };
    } else {
      yield { 
        total, completed, failed, 
        status: `迁移完成但校验未通过 ⚠️${!allMigrated ? ' (部分 chunk 未迁移)' : ''}${!noStale ? ' (存在旧模型数据)' : ''}` 
      };
    }
  }

  // --- Utility functions (public for testing) ---

  /** 
   * 基于 tiktoken (cl100k_base 即 gpt-4 时代的分词规则) 的语义长切边 
   */
  public splitIntoChunks(text: string): ChunkResult[] {
    const enc = get_encoding('cl100k_base');
    const tokens = enc.encode(text);
    const max = EmbeddingService.MAX_CHUNK_TOKENS;
    const overlap = EmbeddingService.CHUNK_OVERLAP_TOKENS;

    if (tokens.length <= max) {
      enc.free();
      return [{ index: 0, text }];
    }

    const chunks: ChunkResult[] = [];
    let start = 0;
    let index = 0;
    while (start < tokens.length) {
      let end = start + max;
      if (end > tokens.length) end = tokens.length;

      const chunkTokens = tokens.slice(start, end);
      // 将 uint32 array 映射回来转回字符串
      const chunkText = new TextDecoder().decode(enc.decode(chunkTokens));
      chunks.push({ index, text: chunkText });

      if (end >= tokens.length) break;

      start = end - overlap;
      if (start >= tokens.length) break;
      index++;
    }

    enc.free();
    return chunks;
  }

  public normalize(vec: number[]): number[] {
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
  }

  private async retryEmbed(action: () => Promise<void>, label: string = '', maxAttempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await action();
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          const delayMs = attempt * 1000;
          logger.warn(`${label} fallback (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`, { error });
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          logger.error(`${label} failed completely:`, { error });
          throw error;
        }
      }
    }
  }

}
