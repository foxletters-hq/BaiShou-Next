import { z } from 'zod';
import { tool } from 'ai';

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
  /**
   * 将一个指定的日记文件从向量库中抹去
   */
  deleteFile?(filePath: string): Promise<void>;
  /**
   * 将一个指定的日记文件载入并在向量库创建碎钻索引
   */
  indexFile?(filePath: string): Promise<void>;
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
 * 结构化总结阅读器接口
 */
export interface ToolSummaryReader {
  readSummary(type: string, startDateIso: string): Promise<{ content: string; generatedAt: string, endDateIso: string } | null>;
  getAvailableSummaries(type: string, limit?: number): Promise<string[]>;
}

/**
 * 去重服务接口——用于记忆去重合并
 */
export interface ToolDeduplicationService {
  checkAndMerge(options: {
    newMemoryContent: string;
    sessionId: string;
    sourceType?: string;
    sourceId?: string;
  }): Promise<{
    action: 'stored' | 'skipped' | 'merged';
    mergedContent?: string;
    removedIds: string[];
    highestSimilarity: number;
  }>;
}

/**
 * 日记全文搜索接口 (FTS5)
 */
export interface ToolDiarySearcher {
  searchFTS(query: string, limit?: number): Promise<Array<{
    date: string;
    contentSnippet: string;
    tags: string;
    rankScore: number;
  }>>;
}

/**
 * 传递给工具执行的上下文
 */
export interface ToolContext {
  sessionId: string;
  vaultName: string;
  embeddingService?: ToolEmbeddingService;
  vectorStore?: ToolVectorStore;
  messageSearcher?: ToolMessageSearcher;
  summaryReader?: ToolSummaryReader;
  deduplicationService?: ToolDeduplicationService;
  diarySearcher?: ToolDiarySearcher;
  userConfig?: Record<string, unknown>;
  /** 允许外部注入基于宿主系统（如 Electron / Web）的真正搜索页面执行器，如果没有则降级走 Native Fetch */
  webSearchResultFetcher?: (url: string) => Promise<string>;
}

/**
 * 对应老白守的工具参数交互配置定义
 */
export interface ToolConfigParam {
  key: string;
  label: string;
  type: 'string' | 'boolean' | 'number' | 'enum';
  defaultValue: unknown;
  description?: string;
  placeholder?: string;
  enumOptions?: { label: string; value: string | number }[];
  isSecret?: boolean; // 如果为 true，密码框呈现
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

  // ─── 工具管理 UI 元数据 ───
  
  get displayName(): string {
    return this.name;
  }
  
  get category(): string {
    return 'general';
  }

  get icon(): string {
    // 桌面端用 Lucide 或者老白守中的 Material Icons，此处以统一规范字符占位提供
    return 'tool'; 
  }

  get canBeDisabled(): boolean {
    return true; // 默认允许被用户从设置页面关闭
  }

  get showInSettings(): boolean {
    return true; // 是否在工具配置清单页显露
  }

  get configurableParams(): ToolConfigParam[] {
    return [];
  }

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
  toVercelTool(context: ToolContext): any {
    return tool({
      description: this.description,
      inputSchema: this.parameters,
      execute: async (args: z.infer<TArgs>) => {
        try {
          console.log(`[AgentTool] Executing tool "${this.name}" with args:`, JSON.stringify(args).slice(0, 200));
          const result = await this.execute(args, context);
          console.log(`[AgentTool] Tool "${this.name}" completed successfully`);
          return result;
        } catch (e: any) {
          console.error(`[AgentTool] Tool "${this.name}" threw an unhandled error:`, e);
          return `工具执行失败 (${this.name}): ${e?.message || String(e)}`;
        }
      },
    });
  }
}
