/**
 * DiaryEditTool — AI 写入/追加/编辑日记内容
 *
 * Agent 通过此工具将内容写入指定日期的 Markdown 日记文件。
 * 支持 append（追加）和 overwrite（覆盖）两种模式。
 *
 * 原始实现：lib/agent/tools/diary/diary_edit_tool.dart (167 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const diaryEditParams = z.object({
  date: z
    .string()
    .optional()
    .describe(
      'The date of the diary to edit, in YYYY-MM-DD format. If omitted, the current date will be used.',
    ),
  content: z.string().describe('The Markdown content to write to the diary.'),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'A list of new tags relevant to this edit (e.g. ["美食", "日常"]). The tool will automatically merge these with existing tags.',
    ),
  mode: z
    .enum(['append', 'overwrite'])
    .optional()
    .describe(
      'Write mode: "append" (default) adds content to the end, "overwrite" replaces the entire file.',
    ),
});

export class DiaryEditTool extends AgentTool<typeof diaryEditParams> {
  readonly name = 'diary_edit';

  readonly description =
    'Write, append, or edit content in a diary entry for a specific date. ' +
    'MANDATORY: You MUST call diary_read FIRST to check if a diary already exists ' +
    'for the target date and review its current content BEFORE calling this tool.\n' +
    'TEMPORAL AWARENESS: When writing entries for past dates, use absolute temporal context. ' +
    "DO NOT write relative words like \"yesterday\" in yesterday's diary.\n" +
    'By default, content is appended. When appending, content MUST be formatted with a level-5 heading using the current time: ' +
    '"##### HH:mm\\n{content}". Use the current_time tool to get the exact time if needed. ' +
    'Set mode to "overwrite" to replace the entire file content.';

  readonly parameters = diaryEditParams;

  async execute(
    args: z.infer<typeof diaryEditParams>,
    context: ToolContext,
  ): Promise<string> {
    const now = new Date();
    const date =
      args.date ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const mode = args.mode ?? 'append';
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return `Error: Invalid date format "${date}". Expected YYYY-MM-DD.`;
    }

    const [year, month] = date.split('-') as [string, string];
    const filePath = join(context.vaultName, 'Journals', year, month, `${date}.md`);

    try {
      // 确保目录存在
      await mkdir(dirname(filePath), { recursive: true });

      let finalContent = args.content;
      let existed = false;

      try {
        const existingContent = await readFile(filePath, 'utf-8');
        existed = true;

        if (mode === 'append') {
          const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const timeHeader = `##### ${hh}:${mm}`;

          const formattedContent = args.content.trimStart().startsWith('#####')
            ? args.content
            : `${timeHeader}\n${args.content}`;

          finalContent = `${existingContent}${separator}${formattedContent}`;
        }
      } catch {
        // 文件不存在——新建
      }

      await writeFile(filePath, finalContent, 'utf-8');

      const action = existed
        ? mode === 'append'
          ? 'appended'
          : 'overwritten'
        : 'created';

      return `Diary for ${date} has been ${action} successfully. (${finalContent.length} characters)`;
    } catch (e) {
      return `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
