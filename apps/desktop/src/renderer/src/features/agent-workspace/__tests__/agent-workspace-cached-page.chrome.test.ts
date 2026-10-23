import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const cached = readFileSync(join(dir, '..', 'AgentWorkspaceCachedPage.tsx'), 'utf8')
const layout = readFileSync(join(dir, '..', 'AgentWorkspaceLayout.tsx'), 'utf8')

describe('AgentWorkspaceCachedPage split chrome', () => {
  it('should keep the home page static and lazy-load workspace, knowledge and skills', () => {
    expect(cached).toContain("import { WorkbenchHomePage } from './workbench/WorkbenchHomePage'")
    expect(cached).toContain('lazy(() =>')
    expect(cached).toContain('./AgentWorkspaceScreen')
    expect(cached).toContain('../knowledge/KnowledgeListPage')
    expect(cached).toContain('./workbench/skills/WorkbenchSkillsPage')
    expect(cached).not.toContain("import { AgentWorkspaceScreen } from './AgentWorkspaceScreen'")
    expect(cached).not.toContain("import { KnowledgeListPage } from '../knowledge'")
    expect(cached).not.toContain(
      "import { WorkbenchSkillsPage } from './workbench/skills/WorkbenchSkillsPage'"
    )
  })

  it('should keep lazy sub-routes inside the workspace layout suspense', () => {
    expect(layout).toContain('Suspense')
    expect(layout).toContain('<Outlet')
  })

  it('should keep the directory sidebar mounted on the workspace layout', () => {
    expect(layout).toContain('WorkbenchDirectorySidebar')
    expect(layout).toContain('directorySidebarHidden')
    expect(layout).toContain('isAgentWorkspaceEditorPath')
    const home = readFileSync(join(dir, '..', 'workbench', 'home', 'WorkbenchHomePage.tsx'), 'utf8')
    const skills = readFileSync(
      join(dir, '..', 'workbench', 'skills', 'WorkbenchSkillsPage.tsx'),
      'utf8'
    )
    expect(home).not.toContain('WorkbenchHomeSidebar')
    expect(skills).not.toContain('WorkbenchHomeSidebar')
  })
})
