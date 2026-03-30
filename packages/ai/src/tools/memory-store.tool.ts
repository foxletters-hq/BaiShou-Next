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
import type { ToolContext } from './agent.tool';

const memoryStoreParams = z.object({
  content: z
    .string()
    .describe(
      'The text content to store as memory. Include clear context, e.g. "User preference: prefers dark theme".',
    ),
  tags: z
    .string()
    .optional()
    .describe(
      'Optional comma-separated tags to categorize the memory. e.g. "preference,UI design"',
    ),
});

export class MemoryStoreTool extends AgentTool<typeof memoryStoreParams> {
  readonly name = 'memory_store';

  readonly description =
    'Store important information as long-term memory for later semantic search retrieval. ' +
    'Use this tool when the user expresses preferences, makes decisions, ' +
    'or when you encounter information worth remembering. ' +
    'Stored memories are vectorized and can be retrieved via the vector_search tool.';

  readonly parameters = memoryStoreParams;

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

    // 如果有标签，附加到内容后面帮助检索
    const fullContent = args.tags
      ? `${args.content}\n[标签: ${args.tags}]`
      : args.content;

    try {
      await embeddingService.embedText({
        text: fullContent,
        sourceType: 'chat',
        sourceId: `mem_${Date.now()}`,
        groupId: context.sessionId,
      });

      const preview =
        args.content.length > 100
          ? args.content.slice(0, 100) + '...'
          : args.content;

      return (
        `记忆已成功存储并建立向量索引。\n内容: ${preview}` +
        (args.tags ? `\n标签: ${args.tags}` : '')
      );
    } catch (e) {
      return `存储记忆失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
