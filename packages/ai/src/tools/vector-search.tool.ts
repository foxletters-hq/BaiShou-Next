/**
 * VectorSearchTool — 向量语义搜索工具
 *
 * 支持纯向量搜索和 FTS5+向量混合搜索两种模式。
 * Agent 通过此工具搜索历史消息和存储的记忆。
 *
 * 原始实现：lib/agent/tools/memory/vector_search_tool.dart (246 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

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

interface ScoredResult {
  chunkText: string;
  score: number;
  source: string;
  createdAt?: Date;
}

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

      let results: ScoredResult[] = [];

      // 向量搜索
      const vectorRaw = await vectorStore.searchSimilar(queryEmbedding, maxResults);
      const vectorResults: ScoredResult[] = vectorRaw.map((r) => ({
        chunkText: r.chunkText,
        score: 1.0 - r.distance,
        source: 'vector',
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
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

        // 简单 RRF 融合
        const ftsResults: ScoredResult[] = ftsRaw.map((r) => ({
          chunkText: r.snippet,
          score: 0,
          source: 'fts',
        }));

        // 合并：向量结果优先，FTS 补充
        const seen = new Set<string>();
        for (const r of vectorResults) {
          if (!seen.has(r.chunkText)) {
            results.push(r);
            seen.add(r.chunkText);
          }
        }
        for (const r of ftsResults) {
          if (!seen.has(r.chunkText)) {
            results.push({ ...r, score: 0.3 }); // FTS 兜底分
            seen.add(r.chunkText);
          }
        }
        pipeline.push(`🔀 RRF融合排序: ${results.length} 条合并`);
      } else {
        results = vectorResults;
      }

      // 排序 + 过滤
      results.sort((a, b) => b.score - a.score);
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
          const t = r.createdAt;
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
