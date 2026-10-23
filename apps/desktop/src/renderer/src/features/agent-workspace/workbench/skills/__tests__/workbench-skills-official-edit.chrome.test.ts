import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const tab = readFileSync(join(dir, '..', 'WorkbenchSkillsSkillTab.tsx'), 'utf8')
const grid = readFileSync(join(dir, '..', 'WorkbenchSkillIconGrid.tsx'), 'utf8')
const page = readFileSync(join(dir, '..', 'WorkbenchSkillsPage.tsx'), 'utf8')

describe('workbench official skills edit chrome', () => {
  it('should omit the edit handler from the official skill grid when rendering official skills', () => {
    const officialStart = tab.indexOf('skills={officialIconSkills}')
    const scopedStart = tab.indexOf('skills={scopedSkills}')
    expect(officialStart).toBeGreaterThan(-1)
    expect(scopedStart).toBeGreaterThan(officialStart)
    expect(tab.slice(officialStart, scopedStart)).not.toContain('onEdit=')
    expect(tab.slice(scopedStart)).toContain('onEdit=')
  })

  it('should render the pencil only when an edit handler is provided', () => {
    expect(grid).toContain('onEdit?:')
    expect(grid).toMatch(/\{onEdit\s*\?[\s\S]*styles\.editBtn[\s\S]*:\s*null\}/)
  })

  it('should refuse to open the editor when the skill is official', () => {
    expect(page).toContain('isWorkbenchSkillEditable')
    expect(page).toContain('handleEditSkill')
  })
})
