import { eq } from 'drizzle-orm'
import { systemSettingsTable } from '../schema/system-settings'
import { SHORTCUT_TRACE_CHAIN, traceCall, dedupePromptShortcuts, type PromptShortcut } from '@baishou/shared'

const KEY = 'prompt_shortcuts_v2'

export const DEFAULT_SHORTCUTS: PromptShortcut[] = [
  {
    id: 'default-translate',
    icon: '🌐',
    name: '翻译',
    command: 'translate',
    content: '请把下面这段话信达雅地翻译为中文（含专业术语解释）：\n\n'
  },
  {
    id: 'default-summarize',
    icon: '📝',
    name: '总结',
    command: 'summarize',
    content: '请总结以下内容背后的核心要义：\n\n'
  }
]

export class PromptShortcutRepository {
  constructor(private readonly db: any) {}

  /**
   * 获取快捷指令列表
   */
  private async readStoredShortcuts(): Promise<PromptShortcut[]> {
    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, KEY))
      .limit(1)

    if (result.length === 0) {
      return []
    }

    try {
      return JSON.parse(result[0].value) as PromptShortcut[]
    } catch (e) {
      console.error(`[PromptShortcutRepository] Failed to parse: ${e}`)
      return []
    }
  }

  async getStoredShortcuts(): Promise<PromptShortcut[]> {
    return traceCall(SHORTCUT_TRACE_CHAIN, 'PromptShortcutRepository.getStored', () =>
      this.readStoredShortcuts()
    )
  }

  async getShortcuts(): Promise<PromptShortcut[]> {
    return traceCall(SHORTCUT_TRACE_CHAIN, 'PromptShortcutRepository.get', async () => {
      const stored = await this.readStoredShortcuts()
      return stored.length > 0 ? stored : DEFAULT_SHORTCUTS
    })
  }

  /**
   * 保存完整的快捷指令列表
   */
  async saveShortcuts(list: PromptShortcut[]): Promise<void> {
    const normalized = dedupePromptShortcuts(list)
    await traceCall(
      SHORTCUT_TRACE_CHAIN,
      'PromptShortcutRepository.save',
      async () => {
        const jsonStr = JSON.stringify(normalized)

        await this.db
          .insert(systemSettingsTable)
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
          })
      },
      { payload: normalized }
    )
  }
}
