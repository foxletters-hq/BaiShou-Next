import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const tabBar = readFileSync(join(dir, '..', 'WorkbenchEditorTabBar.tsx'), 'utf8')
const tabs = readFileSync(join(dir, '..', 'useWorkbenchTabs.ts'), 'utf8')

describe('workbench editor tab marker', () => {
  it('should mark diff tabs with a compare icon when the tab is a diff', () => {
    expect(tabBar).toContain('GitCompare')
    expect(tabBar).toContain("tab.kind === 'diff' || tab.kind === 'git-diff'")
  })

  it('should keep the file name as the title when opening a diff tab', () => {
    expect(tabs).not.toContain('Δ')
  })
})
