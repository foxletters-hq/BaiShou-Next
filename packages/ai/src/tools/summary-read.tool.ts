/**
 * SummaryReadTool — 读取 AI 生成的总结
 *
 * Agent 通过此工具读取周/月/季度/年度总结。
 * 通过文件系统查找 Summaries 目录下对应的总结文件。
 *
 * 原始实现：lib/agent/tools/summary/summary_read_tool.dart (149 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const summaryReadParams = z.object({
  type: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly'])
    .describe('The type of summary to retrieve.'),
  start_date: z
    .string()
    .describe(
      'Start date of the summary period, in YYYY-MM-DD format. ' +
        'For weekly: the Monday of that week. ' +
        'For monthly: the first day of the month (e.g. 2026-03-01). ' +
        'For quarterly: the first day of the quarter. ' +
        'For yearly: the first day of the year (e.g. 2026-01-01).',
    ),
});

export class SummaryReadTool extends AgentTool<typeof summaryReadParams> {
  readonly name = 'summary_read';

  readonly description =
    'Read AI-generated summaries (weekly, monthly, quarterly, or yearly). ' +
    'Returns the summary content for a specific time period. ' +
    'Use diary_list or diary_search for raw diary entries instead.';

  readonly parameters = summaryReadParams;

  async execute(
    args: z.infer<typeof summaryReadParams>,
    context: ToolContext,
  ): Promise<string> {
    if (!context.summaryReader) {
       return '系统错误: 总结报表读取器未挂载注入';
    }

    try {
      const resultObj = await context.summaryReader.readSummary(args.type, args.start_date);
      if (resultObj) {
         return resultObj.content;
      }
      
      // 如果找不到，返回一个列表提示模型哪些是可以看的
      const availableDates = await context.summaryReader.getAvailableSummaries(args.type, 5);
      if (availableDates.length > 0) {
         return `No ${args.type} summary found for ${args.start_date}. Available ${args.type} summaries:\n${availableDates.join('\n')}`;
      }
      
      return `No ${args.type} summaries found in the database.`;
    } catch (e) {
      return `Failed to read summary: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
