import { embed, EmbeddingModel } from 'ai';

export class EmbeddingService {
  /**
   * 初始化需要传入任意 Vercel AI SDK 兼容的 EmbeddingModelV1 实例
   * 比如 text-embedding-3-small 或者 bge-m3 等
   */
  constructor(private readonly model: EmbeddingModel<string>) {}

  /**
   * 将输入的字符串转换为一维浮点数组（供 SQLite sqlite-vec 底层距离计算使用）
   * @param text 要向量化的原始文本
   * @returns number[] (浮点数组)，后续入库需序列化为 Float32Array 的 Buffer
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty string.');
    }

    const { embedding } = await embed({
      model: this.model,
      value: text,
    });

    return embedding;
  }
}
