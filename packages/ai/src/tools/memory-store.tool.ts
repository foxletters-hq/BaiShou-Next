/**
 * MemoryStoreTool — 存储重要信息为长期向量记忆
 *
 * Agent 通过此工具主动存储重要信息。
 * 存储的记忆会被向量化，可通过 vector_search 语义检索。
 *
 * 原始实现：lib/agent/tools/memory/memory_store_tool.dart (126 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext, ToolConfigParam } from './agent.tool';

const memoryStoreParams = z.object({
  content: z.string().describe('The text content to store as memory. Include clear context, e.g. "User preference: prefers dark theme".'),
  tags: z.string().optional().describe('Optional comma-separated tags to categorize the memory. e.g. "preference,UI design"'),
});

export class MemoryStoreTool extends AgentTool<typeof memoryStoreParams> {
  readonly name = 'memory_store';

  readonly description =
    'Store important information as long-term memory for later semantic search retrieval. ' +
    'Use this tool when the user expresses preferences, makes decisions, ' +
    'or when you encounter information worth remembering. ' +
    'Stored memories are vectorized and can be retrieved via the vector_search tool.';

  readonly parameters = memoryStoreParams;

  get category(): string { return 'memory'; }
  get icon(): string { return 'save'; }

  get configurableParams(): ToolConfigParam[] {
    return [
      {
         key: 'memory_dedup_threshold',
         label: 'Deduplication Strictness (0-1.0)',
         type: 'number',
         defaultValue: 0.90, // 余弦相似度大于 0.9 时将其视为完全重复（打回退信）
      }
    ];
  }

  async execute(
    args: z.infer<typeof memoryStoreParams>,
    context: ToolContext,
  ): Promise<string> {
    if (args.content.trim().length === 0) {
      return '请提供要存储的记忆内容。';
    }

    const embeddingService = context.embeddingService;
    if (!embeddingService || !embeddingService.isConfigured) {
      return '嵌入模型未配置，无法存储记忆。请在设置中配置嵌入模型。';
    }

    const fullContent = args.tags ? `${args.content}\n[标签: ${args.tags}]` : args.content;

    try {
      // 在写入之前执行【去重过滤器】！
      if (context.vectorStore) {
         const embArray = await embeddingService.embedQuery(fullContent);
         if (embArray) {
             const similarCount = await context.vectorStore.searchSimilar(embArray, 1);
             const threshold = (context.userConfig?.['memory_dedup_threshold'] as number | undefined) ?? 0.90;
             const firstSimilar = similarCount[0];
             if (firstSimilar) {
                // searchSimilar 按照设定，当 score (打分) 大于门限时！
                // 这里的 distance 从 sqlite 中拿出来实际已经被转化成了 score, 需要做个推断。
                // 比如 假如返回的 distance 是原样，那距离 < (1-threashold) 为重复。
                // 约定上文我们将 score 设置为返回了。如果是通过 searchSimilar 的 distance 字段，我们需要统一它的定义：如果它是 score（越大越好），> 0.9 则去重。
                // 我们之前封装 hybrid-search 是把 `score: 1.0 - rawDist` 交给上游的，为统一抽象 `distance`，我们将其定为差异度度量（距）：
                const theDiffDistance = firstSimilar.distance || 0; 
                // 防护兼容：(如果是 Score，它会逼近 1，这里兼容两者表示法)
                const isDupe = (theDiffDistance < (1 - threshold)) || (theDiffDistance > threshold && threshold > 0.5);
                
                if (isDupe) {
                   return `[MemoryDeduplication Intercept]: Content is too similar to an existing memory (diff=${theDiffDistance.toFixed(3)}). Operation cancelled to prevent duplication!`;
                }
             }
         }
      }

      await embeddingService.embedText({
        text: fullContent,
        sourceType: 'chat',
        sourceId: `mem_${Date.now()}`,
        groupId: context.sessionId,
      });

      const preview = args.content.length > 100 ? args.content.slice(0, 100) + '...' : args.content;
      return `记忆已成功存储并建立向量索引。\n内容: ${preview}` + (args.tags ? `\n标签: ${args.tags}` : '');
    } catch (e) {
      return `存储记忆失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
