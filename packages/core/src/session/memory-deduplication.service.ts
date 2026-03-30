/**
 * 记忆去重与语义合并服务
 *
 * 在 Agent 存储新记忆前，自动完成去重检测和语义合并：
 * 1. 对新记忆做 embedding，在向量库中做 top-K 相似度检索
 * 2. 根据相似度分三种情况处理：
 *    - > duplicateThreshold → 完全重复，跳过
 *    - mergeThreshold ~ duplicateThreshold → LLM 判断是否合并
 *    - < mergeThreshold → 无相关记忆，直接存入
 *
 * 原始实现：lib/agent/rag/memory_deduplication_service.dart (412 行)
 */

// ─── 类型定义 ──────────────────────────────────────────────

export type DeduplicationAction = 'stored' | 'skipped' | 'merged';

export interface DeduplicationResult {
  action: DeduplicationAction;
  /** 合并后的文本（仅 merged 时有值） */
  mergedContent?: string;
  /** 被合并删除的旧记忆 ID 列表 */
  removedIds: string[];
  /** 最高相似度分数（调试用） */
  highestSimilarity: number;
}

export interface ScoredMemory {
  embeddingId: string;
  sourceType: string;
  sourceId: string;
  chunkText: string;
  createdAt: number;
  similarity: number;
}

// ─── 依赖接口（DIP） ─────────────────────────────────────

export interface DeduplicationEmbeddingService {
  embedQuery(text: string): Promise<number[] | null>;
  embedText(options: {
    text: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
  }): Promise<void>;
}

export interface DeduplicationVectorStore {
  searchSimilar(
    queryEmbedding: number[],
    topK: number,
  ): Promise<
    Array<{
      embeddingId: string;
      sourceType: string;
      sourceId: string;
      chunkText: string;
      createdAt: number;
      distance: number;
    }>
  >;
  deleteBySource(sourceType: string, sourceId: string): Promise<void>;
  updateTimestamp(embeddingId: string): Promise<void>;
}

export interface DeduplicationLLM {
  /**
   * 调用 LLM 判断新记忆与已有记忆的关系
   * @returns JSON 字符串: { action, merge_target_ids, merged_content }
   */
  generateContent(prompt: string): Promise<string>;
}

// ─── 服务实现 ─────────────────────────────────────────────

export class MemoryDeduplicationService {
  /** 高于此阈值视为完全重复（跳过存储） */
  static readonly DUPLICATE_THRESHOLD = 0.92;

  /** 高于此阈值进入 LLM 合并判断 */
  static readonly MERGE_THRESHOLD = 0.70;

  /** 检索候选记忆数量 */
  private static readonly TOP_K = 5;

  constructor(
    private readonly embeddingService: DeduplicationEmbeddingService,
    private readonly vectorStore: DeduplicationVectorStore,
    private readonly llm?: DeduplicationLLM,
  ) {}

  /**
   * 在存储新记忆前调用，返回去重/合并结果
   *
   * 如果 LLM 调用失败，fallback 为直接存储（宁可多存也不丢失记忆）
   */
  async checkAndMerge(options: {
    newMemoryContent: string;
    sessionId: string;
    sourceType?: string;
    sourceId?: string;
  }): Promise<DeduplicationResult> {
    try {
      return await this.doCheckAndMerge(options);
    } catch {
      // 去重流程异常，fallback 为直接存储
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }
  }

  private async doCheckAndMerge(options: {
    newMemoryContent: string;
    sessionId: string;
    sourceType?: string;
    sourceId?: string;
  }): Promise<DeduplicationResult> {
    const sourceType = options.sourceType ?? 'chat';

    // 1. 对新记忆做 embedding
    const queryVec = await this.embeddingService.embedQuery(
      options.newMemoryContent,
    );
    if (!queryVec || queryVec.length === 0) {
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }

    // 2. 在向量数据库中做 top-K 相似度检索
    const candidates = await this.vectorStore.searchSimilar(
      queryVec,
      MemoryDeduplicationService.TOP_K,
    );
    if (candidates.length === 0) {
      return { action: 'stored', removedIds: [], highestSimilarity: 0 };
    }

    // 转换 distance → similarity
    const scored: ScoredMemory[] = candidates.map((c) => ({
      embeddingId: c.embeddingId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      chunkText: c.chunkText,
      createdAt: c.createdAt,
      similarity: 1.0 - c.distance,
    }));

    const best = scored[0]!;

    // 3. 根据相似度分三种情况处理

    // ── 完全重复 ──
    if (best.similarity > MemoryDeduplicationService.DUPLICATE_THRESHOLD) {
      await this.vectorStore.updateTimestamp(best.embeddingId);
      return {
        action: 'skipped',
        removedIds: [],
        highestSimilarity: best.similarity,
      };
    }

    // ── 语义相关，需 LLM 判断 ──
    if (best.similarity > MemoryDeduplicationService.MERGE_THRESHOLD) {
      const relevantMemories = scored.filter(
        (s) => s.similarity > MemoryDeduplicationService.MERGE_THRESHOLD,
      );
      return this.llmMergeJudgment({
        newMemoryContent: options.newMemoryContent,
        sessionId: options.sessionId,
        candidates: relevantMemories,
        highestSimilarity: best.similarity,
        sourceType,
        sourceId: options.sourceId,
      });
    }

    // ── 无关 ──
    return {
      action: 'stored',
      removedIds: [],
      highestSimilarity: best.similarity,
    };
  }

  /**
   * 调用 LLM 进行语义合并判断
   */
  private async llmMergeJudgment(params: {
    newMemoryContent: string;
    sessionId: string;
    candidates: ScoredMemory[];
    highestSimilarity: number;
    sourceType: string;
    sourceId?: string;
  }): Promise<DeduplicationResult> {
    const { candidates, highestSimilarity, sourceType } = params;

    if (!this.llm) {
      // 没有 LLM 可用，直接存储
      return { action: 'stored', removedIds: [], highestSimilarity };
    }

    try {
      const existingBlock = candidates
        .map(
          (m) =>
            `- [ID: ${m.embeddingId}] ${m.chunkText}（记录于 ${new Date(m.createdAt).toISOString()}）`,
        )
        .join('\n');

      const prompt = `你是AI记忆管理器。请判断新记忆是否应与已有记忆合并。

## 已有记忆
${existingBlock}

## 新记忆
${params.newMemoryContent}

## 规则
1. 如果新记忆和某条已有记忆表达的是完全相同的事实，输出 "skip"
2. 如果新记忆是对已有记忆的补充、修正或更新，输出 "merge"，并提供合并后的完整记忆文本
3. 如果新记忆是全新的信息，只是主题相关但内容不同，输出 "new"

## 输出格式（严格JSON，不要markdown代码块）
{"action": "merge" | "new" | "skip", "merge_target_ids": [], "merged_content": ""}`;

      const response = await this.llm.generateContent(prompt);
      const parsed = this.parseLlmResponse(response);
      if (!parsed) {
        return { action: 'stored', removedIds: [], highestSimilarity };
      }

      switch (parsed.action) {
        case 'skip':
          if (candidates.length > 0) {
            await this.vectorStore.updateTimestamp(candidates[0]!.embeddingId);
          }
          return { action: 'skipped', removedIds: [], highestSimilarity };

        case 'merge': {
          if (!parsed.mergedContent) {
            return { action: 'stored', removedIds: [], highestSimilarity };
          }

          // 原子操作：删旧 + 插新
          const removedIds: string[] = [];
          for (const targetId of parsed.mergeTargetIds) {
            const target = candidates.find(
              (c) => c.embeddingId === targetId || c.sourceId === targetId,
            );
            if (target) {
              await this.vectorStore.deleteBySource(
                target.sourceType,
                target.sourceId,
              );
              removedIds.push(target.sourceId);
            }
          }

          // 存入合并后的新记忆
          await this.embeddingService.embedText({
            text: parsed.mergedContent,
            sourceType,
            sourceId: params.sourceId ?? `mem_${Date.now()}`,
            groupId: params.sessionId,
          });

          return {
            action: 'merged',
            mergedContent: parsed.mergedContent,
            removedIds,
            highestSimilarity,
          };
        }

        default:
          return { action: 'stored', removedIds: [], highestSimilarity };
      }
    } catch {
      // LLM 合并判断失败，fallback 为直接存储
      return { action: 'stored', removedIds: [], highestSimilarity };
    }
  }

  /**
   * 解析 LLM JSON 响应
   */
  private parseLlmResponse(response: string): {
    action: string;
    mergeTargetIds: string[];
    mergedContent: string;
  } | null {
    try {
      let jsonStr = response.trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const json = JSON.parse(jsonStr) as Record<string, unknown>;
      return {
        action: (json['action'] as string) ?? 'new',
        mergeTargetIds: Array.isArray(json['merge_target_ids'])
          ? (json['merge_target_ids'] as unknown[]).map(String)
          : [],
        mergedContent: (json['merged_content'] as string) ?? '',
      };
    } catch {
      return null;
    }
  }
}
