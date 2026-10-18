import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../mobile-agent-skills.service.ts'),
  'utf8'
)

describe('mobile agent skills chrome', () => {
  it('should migrate stored shortcuts before listing disk skills', () => {
    expect(src).toContain('ensureMobileShortcutsMigrated')
    expect(src.indexOf('ensureMobileShortcutsMigrated')).toBeLessThan(
      src.indexOf('readSkillsFromRoot')
    )
    expect(src).toContain("joinPath(vaultRoot, '.agents', 'skills')")
    expect(src.indexOf("joinPath(vaultRoot, '.agents', 'skills')")).toBeLessThan(
      src.indexOf("joinPath(vaultRoot, 'AI', 'skills')")
    )
  })

  it('should notify the skill list after skill_write and expose a catalog plus reader', () => {
    expect(src).toContain('notifyMobileSkillsChanged')
    expect(src).toContain('mobileListSkillsCatalog')
    expect(src).toContain('createMobileSkillsReader')
    expect(src).toContain('readMobileSkill')
  })

  it('should always preserve DEFAULT_AGENT_SKILLS create-skill when listing skills', () => {
    expect(src).toContain('CREATE_SKILL_SLASH_COMMAND')
    expect(src).toContain('DEFAULT_AGENT_SKILLS')
    expect(src).toContain('hasCreateSkill')
  })

  it('should ensure default software skills before listing disk skills', () => {
    const listIdx = src.indexOf('export async function mobileListSkillShortcuts')
    const ensureIdx = src.indexOf('ensureMobileDefaultSkills', listIdx)
    const rootsIdx = src.indexOf("joinPath(vaultRoot, '.agents', 'skills')", listIdx)
    expect(listIdx).toBeGreaterThan(-1)
    expect(ensureIdx).toBeGreaterThan(listIdx)
    expect(ensureIdx).toBeLessThan(rootsIdx)
  })

  it('should ensure default software skills before skill_read', () => {
    const readerIdx = src.indexOf('export function createMobileSkillsReader')
    const ensureIdx = src.indexOf('ensureMobileDefaultSkills', readerIdx)
    const readIdx = src.indexOf('readMobileSkill', readerIdx)
    expect(readerIdx).toBeGreaterThan(-1)
    expect(ensureIdx).toBeGreaterThan(readerIdx)
    expect(ensureIdx).toBeLessThan(readIdx)
  })
})
