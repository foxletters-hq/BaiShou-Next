import { AgentTool, ToolContext } from './agent.tool';
import { CoreTool } from 'ai';
import { WebSearchTool } from './web-search.tool';
import { UrlReadTool } from './url-read.tool';
import { DiaryListTool } from './diary-list.tool';
import { DiarySearchTool } from './diary-search.tool';
import { DiaryReadTool } from './diary-read.tool';
import { DiaryEditTool } from './diary-edit.tool';
import { DiaryDeleteTool } from './diary-delete.tool';
import { SummaryReadTool } from './summary-read.tool';
import { MemoryStoreTool } from './memory-store.tool';
import { MemoryDeleteTool } from './memory-delete.tool';
import { MessageSearchTool } from './message-search.tool';
import { VectorSearchTool } from './vector-search.tool';
import { CurrentTimeTool } from './current-time.tool';

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  constructor() {
    this.registerAll([
      new WebSearchTool(),
      new UrlReadTool(),
      new DiaryListTool(),
      new DiarySearchTool(),
      new DiaryReadTool(),
      new DiaryEditTool(),
      new DiaryDeleteTool(),
      new SummaryReadTool(),
      new MemoryStoreTool(),
      new MemoryDeleteTool(),
      new MessageSearchTool(),
      new VectorSearchTool(),
      new CurrentTimeTool(),
    ]);
  }

  /**
   * 注册单个工具
   */
  register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: AgentTool[]) {
    tools.forEach(this.register.bind(this));
  }

  /**
   * 获取指定的工具实例
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 以原生态的对象列表交付（包含 UI Metadata 等用于展示层）
   */
  getAllRaw(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 将可供模型调用的工具转换为 Vercel 映射字典并排除用户被禁用的项。
   */
  getEnabledToolsAsVercel(context: ToolContext): Record<string, CoreTool> {
    const disabledIds = new Set(
       Array.isArray(context.userConfig?.['disabledToolIds']) 
         ? context.userConfig!['disabledToolIds'] as string[]
         : []
    );
    
    // 如果大局关掉了 RAG，则所有带记忆向量检索的模块主动切断防患于未然
    const ragEnabled = context.userConfig?.['ragEnabled'] !== false;
    
    const configuredTools: Record<string, CoreTool> = {};

    for (const [name, tool] of this.tools.entries()) {
      // 被显式手动关闭禁言的 Tool
      if (tool.canBeDisabled && disabledIds.has(name)) {
        continue;
      }
      // RAG 全局防呆拦截
      if (!ragEnabled && (name === 'vector_search' || name === 'memory_store')) {
        continue;
      }

      configuredTools[name] = tool.toVercelTool(context);
    }
    return configuredTools;
  }
}
