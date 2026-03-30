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
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

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
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.start_date)) {
      return `Error: Invalid date format "${args.start_date}". Expected YYYY-MM-DD.`;
    }

    const summaryDir = join(context.vaultName, 'Summaries', args.type);
    const fileName = `${args.start_date}.md`;
    const filePath = join(summaryDir, fileName);

    try {
      await access(filePath);
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch {
      // 文件不存在——列出可用总结
      try {
        const files = await readdir(summaryDir);
        const mdFiles = files
          .filter((f) => f.endsWith('.md'))
          .sort()
          .reverse()
          .slice(0, 5);

        if (mdFiles.length === 0) {
          return `No ${args.type} summaries found.`;
        }

        const dates = mdFiles
          .map((f) => `- ${f.replace('.md', '')}`)
          .join('\n');

        return `No ${args.type} summary found for ${args.start_date}. Available ${args.type} summaries:\n${dates}`;
      } catch {
        return `No ${args.type} summaries directory found. The user may not have generated any summaries yet.`;
      }
    }
  }
}
