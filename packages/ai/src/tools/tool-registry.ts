import { CoreTool } from 'ai';
import { AgentTool, ToolContext } from './agent.tool';

/**
 * 工具注册表，负责收集应用内所有的 AgentTool。
 * 1:1 复刻旧版的 ToolRegistry 并适配 Vercel AI SDK。
 */
export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentTool<any>>();

  /**
   * 注册一个新的工具
   * @param tool Agent 工具实例
   */
  register(tool: AgentTool<any>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`AgentTool '${tool.name}' is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 检查是否包含指定的工具
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 按名称获取工具实例
   */
  getTool(name: string): AgentTool<any> | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取当前已注册的所有工具名称列表
   */
  get ids(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 将所有的 AgentTool 转换为 Vercel 需要的 key/value 对象格式，
   * 并在转换过程中绑定执行上下文（Session, Vault 等）。
   */
  toVercelTools(context: ToolContext): Record<string, CoreTool> {
    const record: Record<string, CoreTool> = {};
    for (const [name, tool] of this.tools.entries()) {
      record[name] = tool.toVercelTool(context);
    }
    return record;
  }
}
