import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(join(dir, '..', 'WorkbenchSkillsPage.tsx'), 'utf8')
const grid = readFileSync(join(dir, '..', 'WorkbenchSkillIconGrid.tsx'), 'utf8')
const detail = readFileSync(join(dir, '..', 'WorkbenchSkillDetailDialog.tsx'), 'utf8')

describe('workbench skill detail chrome', () => {
  it('opens the detail dialog from a skill card instead of launching immediately', () => {
    expect(grid).toContain('onOpen(skill)')
    expect(page).toContain('onOpen={openSkillDetail}')
    expect(page).not.toContain('onLaunch={beginUseSkill}')
  })

  it('offers project and companion actions inside the detail dialog', () => {
    expect(detail).toContain('onUseInProject')
    expect(detail).toContain('onUseInCompanion')
    expect(page).toContain('onUseInProject={handleUseSkillInProject}')
    expect(page).toContain('onUseInCompanion={handleUseSkillInCompanion}')
  })

  it('blocks companion launch for project-scoped skills', () => {
    expect(detail).toContain('isProjectSkill')
    expect(detail).toContain('skills_detail_project_only')
    expect(page).toContain("resolveWorkbenchSkillSection(skill.source, skill.name) === 'project'")
    expect(page).toContain('launchSkill(skill, selectedWorkspace.folderRoot)')
  })

  it('passes companion init meta through a draft session before navigating', () => {
    expect(page).toContain('baishou:chat-init-meta:${draftSessionId}')
    expect(page).toContain('buildSkillSendMeta')
    expect(page).toContain('navigate(`/chat/${encodeURIComponent(draftSessionId)}')
  })
})
