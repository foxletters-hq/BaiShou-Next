import {
  isValidSkillName,
  promptShortcutToSkillInput,
  slugifySkillName,
  type PromptShortcut
} from '@baishou/shared'
import {
  listMobileSkillNames,
  writeMobileUserSkill,
  type MobileSkillFs
} from './mobile-skills-writer.util'

/** 与桌面端同一把旗，避免重复把设置里的快捷指令写成 skill */
export const PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY = 'prompt_shortcuts_migrated_to_skills_v1'

export type MobileSkillSettings = {
  get<T>(key: string): Promise<T | null | undefined>
  set(key: string, value: unknown): Promise<void>
}

export async function readStoredMobilePromptShortcuts(
  settings: MobileSkillSettings
): Promise<PromptShortcut[]> {
  const current = await settings.get<PromptShortcut[]>('prompt_shortcuts_v2')
  if (Array.isArray(current) && current.length > 0) return current
  const legacy = await settings.get<PromptShortcut[]>('prompt_shortcuts')
  return Array.isArray(legacy) ? legacy : []
}

/** 把尚未落盘的快捷指令写成存储根 `.agents/skills`，已存在的 name 不覆盖 */
export async function migrateMobileShortcutsToSkills(
  vaultRoot: string,
  shortcuts: PromptShortcut[],
  fs: MobileSkillFs
): Promise<string[]> {
  const existing = new Set(await listMobileSkillNames(vaultRoot, fs))
  const created: string[] = []

  for (const shortcut of shortcuts) {
    const input = promptShortcutToSkillInput(shortcut)
    let name = input.name
    if (!isValidSkillName(name)) name = slugifySkillName(name)
    if (!isValidSkillName(name) || existing.has(name)) continue
    await writeMobileUserSkill(vaultRoot, { ...input, name }, fs)
    existing.add(name)
    created.push(name)
  }

  return created
}

/** 首次列出技能时执行；旗已立则直接返回 */
export async function ensureMobileShortcutsMigrated(options: {
  vaultRoot: string
  settings: MobileSkillSettings
  fs: MobileSkillFs
}): Promise<void> {
  const root = options.vaultRoot.trim()
  if (!root) return
  const flag = await options.settings.get<boolean>(PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY)
  if (flag === true) return

  const shortcuts = await readStoredMobilePromptShortcuts(options.settings)
  await migrateMobileShortcutsToSkills(root, shortcuts, options.fs)
  await options.settings.set(PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY, true)
}
