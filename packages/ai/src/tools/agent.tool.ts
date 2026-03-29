import { z } from 'zod';
import { tool, CoreTool } from 'ai';

/**
 * 传递给工具执行的上下文
 */
export interface ToolContext {
  sessionId: string;
  vaultName: string;
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
