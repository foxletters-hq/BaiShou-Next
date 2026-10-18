import { describe, expect, it } from 'vitest'
import type { PromptShortcut } from '@baishou/shared'
import {
  ensureMobileShortcutsMigrated,
  migrateMobileShortcutsToSkills,
  PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY
} from '../mobile-skills-migrate.util'

function createMemoryFs() {
  const files = new Map<string, string>()
  const dirs = new Set<string>(['/vault'])

  const norm = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '') || '/'
  const parentOf = (value: string) => {
    const index = value.lastIndexOf('/')
    return index <= 0 ? '/' : value.slice(0, index)
  }
  const ensureParents = (value: string) => {
    let current = parentOf(value)
    while (current && current !== '/') {
      dirs.add(current)
      current = parentOf(current)
    }
    dirs.add('/')
  }

  return {
    files,
    async exists(path: string) {
      const next = norm(path)
      return files.has(next) || dirs.has(next)
    },
    async mkdir(path: string, _options?: { recursive?: boolean }) {
      const next = norm(path)
      dirs.add(next)
      ensureParents(next)
    },
    async writeFile(path: string, data: string) {
      const next = norm(path)
      files.set(next, data)
      ensureParents(next)
    },
    async readFile(path: string) {
      const data = files.get(norm(path))
      if (data == null) throw new Error(`ENOENT: ${path}`)
      return data
    },
    async readdir(path: string) {
      const prefix = `${norm(path)}/`
      const names = new Set<string>()
      for (const entry of [...files.keys(), ...dirs]) {
        if (!entry.startsWith(prefix)) continue
        const name = entry.slice(prefix.length).split('/')[0]
        if (name) names.add(name)
      }
      if (!dirs.has(norm(path)) && names.size === 0) {
        throw new Error(`ENOENT: ${path}`)
      }
      return [...names]
    },
    async rm(path: string) {
      const next = norm(path)
      const prefix = `${next}/`
      for (const key of [...files.keys()]) {
        if (key === next || key.startsWith(prefix)) files.delete(key)
      }
      for (const key of [...dirs]) {
        if (key === next || key.startsWith(prefix)) dirs.delete(key)
      }
    }
  }
}

function createSettings(initial: Record<string, unknown> = {}) {
  const store = { ...initial }
  return {
    store,
    async get<T>(key: string) {
      return store[key] as T | undefined
    },
    async set(key: string, value: unknown) {
      store[key] = value
    }
  }
}

const dailyBrief: PromptShortcut = {
  id: 'daily-brief',
  name: '每日简报',
  command: 'daily-brief',
  content: '读日记后给要点。',
  description: 'Summarize the day'
}

describe('migrateMobileShortcutsToSkills', () => {
  it('should write stored shortcuts as user skills when they are not on disk', async () => {
    const fs = createMemoryFs()
    const created = await migrateMobileShortcutsToSkills('/vault', [dailyBrief], fs)

    expect(created).toEqual(['daily-brief'])
    expect(await fs.exists('/vault/.agents/skills/daily-brief/SKILL.md')).toBe(true)
    expect(await fs.readFile('/vault/.agents/skills/daily-brief/SKILL.md')).toContain(
      '读日记后给要点。'
    )
  })

  it('should skip a shortcut whose skill name already exists on disk', async () => {
    const fs = createMemoryFs()
    await fs.mkdir('/vault/.agents/skills/daily-brief', { recursive: true })
    await fs.writeFile('/vault/.agents/skills/daily-brief/SKILL.md', 'name: daily-brief\n\nkeep\n')

    const created = await migrateMobileShortcutsToSkills('/vault', [dailyBrief], fs)

    expect(created).toEqual([])
    expect(await fs.readFile('/vault/.agents/skills/daily-brief/SKILL.md')).toContain('keep')
  })
})

describe('ensureMobileShortcutsMigrated', () => {
  it('should migrate v2 shortcuts once and set the desktop-compatible flag', async () => {
    const fs = createMemoryFs()
    const settings = createSettings({ prompt_shortcuts_v2: [dailyBrief] })

    await ensureMobileShortcutsMigrated({ vaultRoot: '/vault', settings, fs })
    await ensureMobileShortcutsMigrated({ vaultRoot: '/vault', settings, fs })

    expect(settings.store[PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY]).toBe(true)
    expect(await fs.exists('/vault/.agents/skills/daily-brief/SKILL.md')).toBe(true)
  })

  it('should fall back to legacy prompt_shortcuts when v2 is empty', async () => {
    const fs = createMemoryFs()
    const settings = createSettings({
      prompt_shortcuts: [
        {
          id: 'legacy-note',
          name: '旧笔记',
          command: 'legacy-note',
          content: '旧正文'
        }
      ]
    })

    await ensureMobileShortcutsMigrated({ vaultRoot: '/vault', settings, fs })

    expect(await fs.exists('/vault/.agents/skills/legacy-note/SKILL.md')).toBe(true)
    expect(settings.store[PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY]).toBe(true)
  })

  it('should set the flag without writing when there are no stored shortcuts', async () => {
    const fs = createMemoryFs()
    const settings = createSettings()

    await ensureMobileShortcutsMigrated({ vaultRoot: '/vault', settings, fs })

    expect(settings.store[PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY]).toBe(true)
    expect(await fs.exists('/vault/.agents/skills')).toBe(false)
  })

  it('should not migrate when the vault root is empty', async () => {
    const fs = createMemoryFs()
    const settings = createSettings({ prompt_shortcuts_v2: [dailyBrief] })

    await ensureMobileShortcutsMigrated({ vaultRoot: '  ', settings, fs })

    expect(settings.store[PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY]).toBeUndefined()
    expect(await fs.exists('/vault/.agents/skills/daily-brief/SKILL.md')).toBe(false)
  })
})
