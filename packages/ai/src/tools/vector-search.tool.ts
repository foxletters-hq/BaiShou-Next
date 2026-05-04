/**
 * VectorSearchTool — 向量语义搜索工具
 *
 * 支持纯向量搜索和 FTS5+向量混合搜索两种模式。
 * 混合搜索使用 RRF (Reciprocal Rank Fusion) 算法融合排序。
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { HybridSearchUtils } from '../rag/hybrid-search';
import type { ISearchResult } from '../rag/hybrid-search.types';

const vectorSearchParams = z.object({
  query: z
    .string()
    .describe('要搜索的语义查询，描述你想找的内容的含义'),
  mode: z
    .enum(['vector', 'hybrid'])
    .optional()
    .describe(
      '搜索模式: vector=纯语义搜索, hybrid=语义+关键词混合搜索（推荐）',
    ),
  min_score: z
    .number()
    .optional()
    .describe(
      '最低相似度阈值(0-1)，低于此分数的结果将被过滤。默认 0.4',
    ),
});

export class VectorSearchTool extends AgentTool<typeof vectorSearchParams> {
  readonly name = 'vector_search';

  readonly description =
    'Semantic search over conversation history and stored memories. ' +
    'When the user asks about past content, previous decisions, personal preferences, ' +
    'or anything discussed before, you MUST call this tool first. ' +
    'Returns the most semantically relevant conversation snippets with scores.';

  readonly parameters = vectorSearchParams;

  async execute(
    args: z.infer<typeof vectorSearchParams>,
    context: ToolContext,
  ): Promise<string> {
    if (args.query.trim().length === 0) {
      return '请提供搜索查询内容。';
    }

    const embeddingService = context.embeddingService;
    const vectorStore = context.vectorStore;

    if (!embeddingService || !vectorStore) {
      return '嵌入服务或向量数据库未配置，无法执行语义搜索。';
    }

    const mode = args.mode ?? 'hybrid';
    const minScore = args.min_score ??
      ((context.userConfig?.['rag_similarity_threshold'] as number | undefined) ?? 0.4);
    const maxResults =
      (context.userConfig?.['rag_top_k'] as number | undefined) ?? 20;

    try {
      const queryEmbedding = await embeddingService.embedQuery(args.query);
      if (!queryEmbedding) {
        return '嵌入模型未配置或查询嵌入失败。请在设置中配置嵌入模型。';
      }

      const pipeline: string[] = [];
      pipeline.push(
        `⚙️ 参数: topK=${maxResults}, 阈值=${minScore.toFixed(2)}, 模式=${mode}`,
      );

      let results: ISearchResult[] = [];

      // 向量搜索
      const vectorRaw = await vectorStore.searchSimilar(queryEmbedding, maxResults);
      const vectorResults: ISearchResult[] = vectorRaw.map((r) => ({
        messageId: r.sourceId,
        sessionId: r.groupId,
        chunkText: r.chunkText,
        score: 1.0 - r.distance,
        source: 'vector' as const,
        createdAt: r.createdAt,
      }));

      const bestVecScore = vectorResults.length > 0
        ? vectorResults[0]!.score.toFixed(4)
        : '-';
      pipeline.push(
        `🔍 向量语义搜索: ${vectorResults.length} 条命中 (最佳 ${bestVecScore})`,
      );

      if (mode === 'hybrid' && vectorStore.searchFts) {
        // FTS5 关键词搜索
        const ftsRaw = await vectorStore.searchFts(args.query, maxResults);
        pipeline.push(`📝 FTS关键词搜索: ${ftsRaw.length} 条命中`);

        const ftsResults: ISearchResult[] = ftsRaw.map((r) => ({
          messageId: r.messageId,
          sessionId: r.sessionId,
          chunkText: r.snippet,
          score: 0,
          source: 'fts' as const,
        }));

        // 使用 RRF 算法融合排序（对齐原版 k=60, ftsWeight=0.3, vectorWeight=0.7）
        results = HybridSearchUtils.mergeRRF(ftsResults, vectorResults, maxResults);
        pipeline.push(`🔀 RRF融合排序: ${results.length} 条合并`);
      } else {
        results = vectorResults;
      }

      // 过滤低分
      const beforeCount = results.length;
      if (minScore > 0) {
        results = results.filter((r) => r.score >= minScore);
      }
      pipeline.push(
        `✂️ 相似度过滤 (≥${minScore.toFixed(2)}): ${beforeCount} → ${results.length} 条`,
      );

      if (results.length === 0) {
        return `${pipeline.join('\n')}\n没有找到语义相关的历史消息（阈值=${minScore}）。`;
      }

      // 格式化输出
      const lines: string[] = [];
      lines.push('═══ 搜索流水线 ═══');
      lines.push(...pipeline);
      lines.push('═══════════════');
      lines.push('');
      lines.push(`找到 ${results.length} 条相关记忆：\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        const sourceLabel =
          r.source === 'hybrid' ? '混合' : r.source === 'fts' ? 'FTS' : '向量';
        lines.push(`--- 结果 ${i + 1} [${sourceLabel}] ---`);
        if (r.createdAt) {
          const t = new Date(r.createdAt);
          const y = t.getFullYear();
          const m = String(t.getMonth() + 1).padStart(2, '0');
          const d = String(t.getDate()).padStart(2, '0');
          const hh = String(t.getHours()).padStart(2, '0');
          const mm = String(t.getMinutes()).padStart(2, '0');
          lines.push(`时间: ${y}-${m}-${d} ${hh}:${mm}`);
        }
        lines.push(`内容: ${r.chunkText}`);
        lines.push(`相似度: ${r.score.toFixed(4)}`);
        lines.push('');
      }

      return lines.join('\n');
    } catch (e) {
      return `语义搜索失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
