/**
 * MemoryDeduplicationService — 三级记忆去重与合并
 *
 * 对标原版 Flutter 的 memory_deduplication_service.dart：
 *   - Tier 1 (>0.92): 精确重复，跳过存储
 *   - Tier 2 (0.70-0.92): 语义重叠，调用 LLM 判断合并/跳过/新增
 *   - Tier 3 (<0.70): 全新信息，直接存储
 *
 * 失败时 fallback 到 'stored'（不丢失记忆）。
 */

import { generateText } from 'ai';
import type { IAIProvider } from '../providers/provider.interface';
import type { ToolEmbeddingService, ToolVectorStore, ToolDeduplicationService } from '../tools/agent.tool';
import { logger } from '@baishou/shared';

/** 相似度 > 此值视为精确重复 */
const DUPLICATE_THRESHOLD = 0.92;
/** 相似度 > 此值触发 LLM 合并判断 */
const MERGE_THRESHOLD = 0.70;
/** 候选记忆检索数量 */
const TOP_K = 5;

/** 去重结果 */
interface DeduplicationResult {
  action: 'stored' | 'skipped' | 'merged';
  mergedContent?: string;
  removedIds: string[];
  highestSimilarity: number;
}

/** 候选记忆条目 */
interface CandidateMemory {
  embeddingId: string;
  sourceId: string;
  chunkText: string;
  similarity: number;
  createdAt?: number;
}

/** LLM 合并判断返回结构 */
interface LlmMergeDecision {
  action: 'merge' | 'new' | 'skip';
  merge_target_ids: string[];
  merged_content: string;
}

export class MemoryDeduplicationServiceImpl implements ToolDeduplicationService {
  constructor(
    private readonly embeddingService: ToolEmbeddingService,
    private readonly vectorStore: ToolVectorStore,
    private readonly provider: IAIProvider,
    private readonly modelId: string,
  ) {}

  async checkAndMerge(options: {
    newMemoryContent: string;
    sessionId: string;
    sourceType?: string;
    sourceId?: string;
  }): Promise<DeduplicationResult> {
    try {
      return await this._doCheckAndMerge(options);
    } catch (e) {
      // 失败时 fallback 到直接存储，不丢失记忆
      logger.warn('[MemoryDedup] 去重流程异常，降级为直接存储:', e);
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }
  }

  private async _doCheckAndMerge(options: {
    newMemoryContent: string;
    sessionId: string;
    sourceType?: string;
    sourceId?: string;
  }): Promise<DeduplicationResult> {
    const { newMemoryContent } = options;

    // 1. 对新记忆进行向量化
    const queryVector = await this.embeddingService.embedQuery(newMemoryContent);
    if (!queryVector) {
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }

    // 2. 检索最相似的 TOP_K 条记忆
    const rawResults = await this.vectorStore.searchSimilar(queryVector, TOP_K);
    if (rawResults.length === 0) {
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }

    // 3. 转换 distance → similarity，构建候选列表
    const candidates: CandidateMemory[] = rawResults.map(r => ({
      embeddingId: r.sourceId,
      sourceId: r.sourceId,
      chunkText: r.chunkText,
      similarity: 1.0 - r.distance,
      createdAt: r.createdAt,
    }));

    candidates.sort((a, b) => b.similarity - a.similarity);
    const best = candidates[0]!;
    const bestSimilarity = best.similarity;

    // ── Tier 1: 精确重复（>0.92） ──
    if (bestSimilarity > DUPLICATE_THRESHOLD) {
      logger.info(`[MemoryDedup] 精确重复 (sim=${bestSimilarity.toFixed(3)})，跳过存储`);
      return { action: 'skipped', removedIds: [], highestSimilarity: bestSimilarity };
    }

    // ── Tier 2: 语义重叠（0.70-0.92）→ LLM 合并判断 ──
    if (bestSimilarity > MERGE_THRESHOLD) {
      const overlapCandidates = candidates.filter(c => c.similarity > MERGE_THRESHOLD);
      const decision = await this._callLlmForMerge(overlapCandidates, newMemoryContent);

      if (!decision) {
        // LLM 调用失败，fallback 到存储
        return { action: 'stored', removedIds: [], highestSimilarity: bestSimilarity };
      }

      switch (decision.action) {
        case 'skip':
          return { action: 'skipped', removedIds: [], highestSimilarity: bestSimilarity };

        case 'merge': {
          // 验证 merge_target_ids 防止幻觉删除
          const validIds = decision.merge_target_ids.filter(id =>
            overlapCandidates.some(c => c.embeddingId === id || c.sourceId === id)
          );

          const removedIds: string[] = [];
          for (const id of validIds) {
            const candidate = overlapCandidates.find(
              c => c.embeddingId === id || c.sourceId === id
            );
            if (candidate) {
              await this.vectorStore.deleteBySource('memory', candidate.sourceId);
              removedIds.push(candidate.sourceId);
            }
          }

          // 存储合并后的内容
          const mergedText = decision.merged_content || newMemoryContent;
          await this.embeddingService.embedText({
            text: mergedText,
            sourceType: 'memory',
            sourceId: options.sourceId ?? `mem_${Date.now()}`,
            groupId: options.sessionId,
          });

          return { action: 'merged', mergedContent: mergedText, removedIds, highestSimilarity: bestSimilarity };
        }

        case 'new':
        default:
          return { action: 'stored', removedIds: [], highestSimilarity: bestSimilarity };
      }
    }

    // ── Tier 3: 全新信息（<0.70） ──
    return { action: 'stored', removedIds: [], highestSimilarity: bestSimilarity };
  }

  /**
   * 调用 LLM 判断是否应合并记忆
   * 使用全局对话模型（与原版一致）
   */
  private async _callLlmForMerge(
    candidates: CandidateMemory[],
    newMemoryContent: string,
  ): Promise<LlmMergeDecision | null> {
    try {
      const existingBlock = candidates
        .map(c => {
          const ts = c.createdAt ? new Date(c.createdAt).toISOString() : '未知时间';
          return `- [ID: ${c.embeddingId}] ${c.chunkText}（记录于 ${ts}）`;
        })
        .join('\n');

      const model = this.provider.getLanguageModel(this.modelId);

      const { text } = await generateText({
        model,
        system: '你是AI记忆管理器。请严格按照要求输出JSON，不要添加任何额外解释。',
        messages: [
          {
            role: 'user',
            content: `请判断新记忆是否应与已有记忆合并。

## 已有记忆
${existingBlock}

## 新记忆
${newMemoryContent}

## 规则
1. 如果新记忆和某条已有记忆表达的是完全相同的事实，输出 "skip"
2. 如果新记忆是对已有记忆的补充、修正或更新，输出 "merge"，并提供合并后的完整记忆文本
3. 如果新记忆是全新的信息，只是主题相关但内容不同，输出 "new"

## 输出格式（严格JSON，不要markdown代码块）
{"action": "merge" | "new" | "skip", "merge_target_ids": [], "merged_content": ""}`,
          },
        ],
        temperature: 0.1,
      });

      if (!text) return null;

      // 从 LLM 响应中提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as LlmMergeDecision;
      if (!['merge', 'new', 'skip'].includes(parsed.action)) return null;

      return parsed;
    } catch (e) {
      logger.warn('[MemoryDedup] LLM 合并判断失败:', e);
      return null;
    }
  }
}
