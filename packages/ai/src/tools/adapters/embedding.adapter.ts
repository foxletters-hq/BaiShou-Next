import { ToolEmbeddingService } from '../agent.tool';
import { IAIProvider } from '../../providers/provider.interface';
import { embed } from 'ai';
import { SqliteHybridSearchRepository } from '@baishou/database';

export class EmbeddingAdapter implements ToolEmbeddingService {
  /**
   * @param provider BaiShou 核心层提供的带有 Vercel 标准转化能力的 AI 供应商
   * @param modelId 使用模型的 ID（如 deepseek-chat 或 embedding 模型）
   * @param hybridRepo 向量存库的底层 Drizzle/BetterSqlite3 接口
   */
  constructor(
    private provider: IAIProvider,
    private modelId: string,
    private hybridRepo?: SqliteHybridSearchRepository // 可选，因为如果只调用 embedQuery 不需要入库
  ) {}

  get isConfigured(): boolean {
    return true; // 只要它被挂载并传入，就意味着模型算力在线
  }

  async embedQuery(text: string): Promise<number[] | null> {
    try {
      const { embedding } = await embed({
        model: this.provider.getEmbeddingModel ? this.provider.getEmbeddingModel(this.modelId) : this.provider.getLanguageModel(this.modelId) as any,
        value: text,
      });
      return embedding;
    } catch (e) {
      console.warn('[EmbeddingAdapter] 查询特征抽取失败', e);
      return null;
    }
  }

  async embedText(options: {
    text: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
  }): Promise<void> {
     if (!this.hybridRepo) {
        throw new Error('hybridRepo must be provided to store embeddings permanently.');
     }

     const embVector = await this.embedQuery(options.text);
     if (!embVector) {
        throw new Error('Failed to extract vector from provided text string.');
     }

     await this.hybridRepo.insertEmbedding({
        id: crypto.randomUUID(),
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        groupId: options.groupId,
        chunkIndex: 0,
        chunkText: options.text,
        embedding: embVector,
        modelId: this.modelId,
        sourceCreatedAt: Date.now()
     });
  }
}
