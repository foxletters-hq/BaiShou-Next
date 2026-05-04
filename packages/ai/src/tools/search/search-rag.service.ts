import { cosineSimilarity } from 'ai';
import { ToolEmbeddingService } from '../agent.tool';

export interface CompressInput {
  query: string;
  results: Array<{ title: string; url: string; content: string }>;
  embeddingService: ToolEmbeddingService;
  totalMaxChunks?: number;
}

export interface CompressedResult {
  title: string;
  url: string;
  content: string;
  avgScore: number;
}

export class SearchRagService {
  /**
   * 对网络搜索结果进行语义压缩：按与 query 的相关度排序，返回最相关的 Top-K 结果。
   */
  static async compress(input: CompressInput): Promise<CompressedResult[]> {
    const { query, results, embeddingService, totalMaxChunks = 5 } = input;

    if (!embeddingService.isConfigured || results.length === 0) {
      return results.map(r => ({ ...r, avgScore: 0 }));
    }

    try {
      const queryEmbedding = await embeddingService.embedQuery(query);
      if (!queryEmbedding) {
        return results.map(r => ({ ...r, avgScore: 0 }));
      }

      // 对每个 result 的 content 做分块、嵌入、计算相似度
      const scoredResults: CompressedResult[] = [];

      for (const result of results) {
        const text = result.content || '';
        if (!text.trim()) {
          scoredResults.push({ ...result, content: text, avgScore: 0 });
          continue;
        }

        const chunks = this.splitIntoChunks(text, 600);
        const limitedChunks = chunks.slice(0, 10); // 每个结果最多 10 块

        let totalScore = 0;
        let scoredChunkCount = 0;

        for (const chunk of limitedChunks) {
          try {
            const chunkEmb = await embeddingService.embedQuery(chunk);
            if (chunkEmb) {
              totalScore += cosineSimilarity(queryEmbedding, chunkEmb);
              scoredChunkCount++;
            }
          } catch { /* skip failed chunks */ }
        }

        const avgScore = scoredChunkCount > 0 ? totalScore / scoredChunkCount : 0;
        scoredResults.push({ ...result, content: text, avgScore });
      }

      // 按平均相似度降序排列，取前 totalMaxChunks 个
      scoredResults.sort((a, b) => b.avgScore - a.avgScore);
      return scoredResults.slice(0, totalMaxChunks);

    } catch (e: any) {
      console.warn('[SearchRagService] compress failed, returning unranked:', e.message);
      return results.map(r => ({ ...r, avgScore: 0 }));
    }
  }

  /**
   * 在提取超大型文档时，不在外层建库，而是生成临时的单文件切片与 Embedding
   * 以期直接返回和用户查询 (query) 最相关的 Top-K 内容。
   */
  static async extractRelevantChunks(
    embeddingService: ToolEmbeddingService,
    fullText: string,
    query: string,
    maxOutputTokens: number = 8000
  ): Promise<string> {
    // 基础过滤，如果文章根本不够长，直接返回，不需要动用刺刀
    if (fullText.length < 5000) {
      return fullText;
    }

    try {
      if (!embeddingService.isConfigured) {
        return fullText.slice(0, maxOutputTokens);
      }

      // 1. 段落粗分切 (粗切约 500-1000 字)
      let chunks = this.splitIntoChunks(fullText, 800);
      if (chunks.length === 0) return fullText.slice(0, maxOutputTokens);

      // 上限保护以防由于巨量导致 embedMany 爆掉 (比如取前 100 块最多提取开头5万字)
      chunks = chunks.slice(0, 50);

      // 2. 将 Query 和 Chunks 喂入 Embedding
      const queryEmbedding = await embeddingService.embedQuery(query);
      if (!queryEmbedding) return fullText.slice(0, maxOutputTokens);

      const chunkEmbeddings: (number[] | null)[] = [];
      // 如果长度很长，为了防并发过高导致挂掉（比如RateLimit），用串行查询
      for (const ch of chunks) {
         try {
           const emb = await embeddingService.embedQuery(ch);
           chunkEmbeddings.push(emb);
         } catch(e) { chunkEmbeddings.push(null); }
      }

      // 3. 计算各个分片相对于 Query 的 Cosine 相似度
      const scoredChunks: Array<{ score: number, text: string }> = [];
      for (let i = 0; i < chunkEmbeddings.length; i++) {
         const cev = chunkEmbeddings[i];
         if (!cev) continue;
         const score = cosineSimilarity(queryEmbedding, cev);
         scoredChunks.push({ score, text: chunks[i] });
      }

      // 4. 倒排取最相关的前 K 个拼接到最大可配额度
      scoredChunks.sort((a, b) => b.score - a.score);

      let resultText = '';
      for (const sc of scoredChunks) {
         if (resultText.length + sc.text.length > maxOutputTokens) break;
         resultText += `[片段 (Relevance: ${sc.score.toFixed(2)})]\n${sc.text}\n\n`;
      }

      if (resultText.length > 0) {
         return resultText;
      } else {
         return fullText.slice(0, maxOutputTokens);
      }

    } catch (e: any) {
      console.warn('[SearchRagService] Failed to dynamically construct in-memory RAG:', e);
      // Fallback
      return fullText.slice(0, maxOutputTokens);
    }
  }

  private static splitIntoChunks(text: string, chunkSize: number = 800): string[] {
    const lines = text.split(/\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
      if (currentChunk.length + line.length > chunkSize) {
        if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
}
