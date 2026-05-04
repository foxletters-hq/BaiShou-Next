import { ToolEmbeddingService } from '../agent.tool';
import { IAIProvider } from '../../providers/provider.interface';
import { embed } from 'ai';
import { SqliteHybridSearchRepository } from '@baishou/database';

/** 最大分块 token 数（对齐原版 1024 字符≈512 token） */
const MAX_CHUNK_LENGTH = 1024;
/** 分块重叠字符数 */
const CHUNK_OVERLAP = 128;

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

     // 对齐原版：长文本先分块，每块独立嵌入入库
     const chunks = splitIntoChunks(options.text);

     for (let i = 0; i < chunks.length; i++) {
       const chunk = chunks[i]!;
       const embVector = await this.embedQuery(chunk);
       if (!embVector) {
         console.warn(`[EmbeddingAdapter] 分块 ${i} 嵌入失败，跳过`);
         continue;
       }

       await this.hybridRepo.insertEmbedding({
         id: `${options.sourceId}_chunk_${i}`,
         sourceType: options.sourceType,
         sourceId: options.sourceId,
         groupId: options.groupId,
         chunkIndex: i,
         chunkText: chunk,
         embedding: embVector,
         modelId: this.modelId,
         sourceCreatedAt: Date.now()
       });
     }
  }
}

/**
 * 滑动窗口分块（对齐原版 EmbeddingService._splitIntoChunks）
 *
 * 纯字符长度滑动窗口，不做自然断句。
 * 短文本（≤MAX_CHUNK_LENGTH）返回单块。
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_LENGTH, text.length);
    chunks.push(text.substring(start, end));
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
