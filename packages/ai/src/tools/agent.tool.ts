import { z } from 'zod';
import { tool, CoreTool } from 'ai';

/**
 * 嵌入服务接口——工具不关心具体实现（DIP）
 */
export interface ToolEmbeddingService {
  isConfigured: boolean;
  embedQuery(text: string): Promise<number[] | null>;
  embedText(options: {
    text: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
  }): Promise<void>;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult {
  sourceType: string;
  sourceId: string;
  groupId: string;
  chunkText: string;
  distance: number;
  createdAt?: number;
}

/**
 * 向量数据库接口——用于搜索和删除嵌入
 */
export interface ToolVectorStore {
  searchSimilar(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]>;
  deleteBySource(sourceType: string, sourceId: string): Promise<void>;
  searchFts?(query: string, limit: number): Promise<Array<{
    messageId: string;
    sessionId: string;
    snippet: string;
  }>>;
}

/**
 * 消息搜索接口——用于跨会话关键词搜索
 */
export interface ToolMessageSearcher {
  searchMessages(query: string, limit: number): Promise<Array<{
    role: string;
    snippet: string;
    sessionTitle: string;
    date: string;
  }>>;
}

/**
 * 传递给工具执行的上下文
 */
export interface ToolContext {
  sessionId: string;
  vaultName: string;
  /** 嵌入服务（可选，由宿主层注入） */
  embeddingService?: ToolEmbeddingService;
  /** 向量数据库（可选，由宿主层注入） */
  vectorStore?: ToolVectorStore;
  /** 消息搜索器（可选，由宿主层注入） */
  messageSearcher?: ToolMessageSearcher;
  /** 用户自定义工具参数 */
  userConfig?: Record<string, unknown>;
}

/**
 * 抽象工具基类，1:1 复刻白守的面向对象工具抽象。
 * 通过 toVercelTool 方法将其桥接到 Vercel AI SDK。
 */
export abstract class AgentTool<TArgs extends z.ZodType = any> {
  /** 工具的唯一标识名称（只允许字母、数字和下划线） */
  abstract readonly name: string;
  
  /** 给大模型看的工具描述，解释工具的作用和何时使用 */
  abstract readonly description: string;
  
  /** 工具接受的参数 Schema (基于 Zod) */
  abstract readonly parameters: TArgs;

  /**
   * 工具的执行逻辑
   * @param args 强类型推导后的执行参数
   * @param context 环境上下文
   * @returns 工具执行结果的字符串形式（如需 JSON 请返回 stringified JSON）
   */
  abstract execute(args: z.infer<TArgs>, context: ToolContext): Promise<string>;

  /**
   * 将面向对象的 AgentTool 转化为 Vercel AI SDK 的 CoreTool 格式
   */
  toVercelTool(context: ToolContext): CoreTool {
    return tool({
      description: this.description,
      parameters: this.parameters,
      execute: async (args: z.infer<TArgs>) => {
        return await this.execute(args, context);
      },
    });
  }
}
