import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'prefetch-workbench-home.ts'),
  'utf8'
)

describe('prefetchWorkbenchHome chrome', () => {
  it('should prefetch only the workbench home shell', () => {
    expect(src).toContain('AgentWorkspaceCachedPage')
    expect(src).toContain('requestIdleCallback')
    expect(src).not.toContain('AgentWorkspaceScreen')
    expect(src).not.toContain('KnowledgeListPage')
    expect(src).not.toContain('WorkbenchSkillsPage')
  })
})
