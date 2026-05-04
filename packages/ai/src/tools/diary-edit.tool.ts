import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryEditParams = z.object({
  date: z
    .string()
    .describe('The exact date of the diary to edit. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe('The markdown content for the diary.'),
  mode: z
    .enum(['append', 'overwrite'])
    .optional()
    .default('append')
    .describe('Edit mode. "append" adds content with a timestamp header (default). "overwrite" replaces the entire file.'),
  tags: z
    .string()
    .optional()
    .describe('Comma-separated tags to add/merge into the diary. Existing tags are preserved.'),
});

export class DiaryEditTool extends AgentTool<typeof diaryEditParams> {
  readonly name = 'diary_edit';

  readonly description =
    'Modify an existing diary entry. ' +
    'Default mode is "append", which adds new content with a timestamp header (##### HH:mm). ' +
    'Use "overwrite" mode to replace the entire content. ' +
    'Tags are automatically merged with existing ones.';

  readonly parameters = diaryEditParams;

  async execute(
    args: z.infer<typeof diaryEditParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`;
    }

    const year = args.date.substring(0, 4);
    const month = args.date.substring(5, 7);
    const fileName = `${args.date}.md`;
    const filePath = join(context.vaultName, 'Journals', year, month, fileName);

    try {
      await access(filePath);
    } catch {
      return `Error: Diary entry for ${args.date} does not exist. Use diary_write to create it instead.`;
    }

    try {
      let finalContent: string;

      if (args.mode === 'overwrite') {
        finalContent = args.content;
      } else {
        // append mode: read existing, append with timestamp header
        const existing = await readFile(filePath, 'utf-8');
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `\n\n##### ${hours}:${minutes}\n\n`;
        finalContent = existing.trimEnd() + timestamp + args.content;
      }

      // Handle tag merging if tags are provided
      if (args.tags) {
        const raw = await readFile(filePath, 'utf-8');
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const fmBlock = fmMatch[1]!;
          const tagsLine = fmBlock.split('\n').find(l => l.trim().startsWith('tags:'));
          if (tagsLine) {
            const existingTagStr = tagsLine.substring(tagsLine.indexOf(':') + 1).trim();
            const clean = existingTagStr.replace(/^\[/, '').replace(/\]$/, '');
            const existingTags = clean.split(',').map(s => s.trim()).filter(Boolean);
            const newTags = args.tags.split(',').map(s => s.trim()).filter(Boolean);
            const merged = Array.from(new Set([...existingTags, ...newTags]));
            // Replace tags line in frontmatter
            const newFm = fmBlock.replace(tagsLine, `tags: [${merged.join(', ')}]`);
            finalContent = finalContent.replace(fmBlock, newFm);
          } else {
            // Add tags line to frontmatter
            const newTags = args.tags.split(',').map(s => s.trim()).filter(Boolean);
            const insertBefore = fmBlock.lastIndexOf('\n');
            const newFm = fmBlock.substring(0, insertBefore) + `\ntags: [${newTags.join(', ')}]` + fmBlock.substring(insertBefore);
            finalContent = finalContent.replace(fmBlock, newFm);
          }
        }
      }

      await writeFile(filePath, finalContent, 'utf-8');

      if (context.vectorStore) {
        try {
          await context.vectorStore.deleteFile?.(filePath);
          await context.vectorStore.indexFile?.(filePath);
        } catch (e) {
          console.warn('[Tool] Failed to index on edit', e);
        }
      }

      return `Successfully modified the diary entry for ${args.date} (${args.mode || 'append'} mode).`;
    } catch (e) {
      return `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
