import { eq } from 'drizzle-orm';
import { systemSettingsTable } from '../schema/system-settings';
import type { PromptShortcut } from '@baishou/shared';

const KEY = 'prompt_shortcuts_v2';

export const DEFAULT_SHORTCUTS: PromptShortcut[] = [
  {
    id: 'default-translate',
    icon: '🌐',
    name: '翻译助手 (Translate)', // t.agent.tools.shortcuts.translate_name mapping mock
    content: '请作为专业翻译，翻译后续的文本内容，保持原文格式。',
  },
  {
    id: 'default-summarize',
    icon: '📝',
    name: '长文总结 (Summarize)', // t.agent.tools.shortcuts.summarize_name mapping mock
    content: '请将上述内容提炼成几条关键要点。',
  },
];

export class PromptShortcutRepository {
  constructor(private readonly db: any) {}

  /**
   * 获取快捷指令列表
   */
  async getShortcuts(): Promise<PromptShortcut[]> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, KEY))
      .limit(1);

    if (result.length === 0) {
      return DEFAULT_SHORTCUTS;
    }

    try {
      return JSON.parse(result[0].value) as PromptShortcut[];
    } catch (e) {
      console.error(`[PromptShortcutRepository] Failed to parse: ${e}`);
      return DEFAULT_SHORTCUTS;
    }
  }

  /**
   * 保存完整的快捷指令列表
   */
  async saveShortcuts(list: PromptShortcut[]): Promise<void> {
    const jsonStr = JSON.stringify(list);
    
    await this.db.insert(systemSettingsTable)
      .values({
        key: KEY,
        value: jsonStr,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: jsonStr,
          updatedAt: new Date()
        }
      });
  }
}
