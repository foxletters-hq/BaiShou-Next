import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('workbench notebook mount chrome', () => {
  it('should mount from the home composer without a session and use an official checkbox', () => {
    const home = readFileSync(join(here, '..', 'home', 'WorkbenchHomeComposer.tsx'), 'utf8')
    const dialog = readFileSync(join(here, '..', 'WorkbenchNotebookMountDialog.tsx'), 'utf8')
    const stream = readFileSync(
      join(here, '..', '..', 'hooks', 'useWorkspaceAgentStream.ts'),
      'utf8'
    )
    expect(home).toContain('onOpenNotebookMount')
    expect(home).toContain('scope="workbench"')
    expect(dialog).toContain("from '@baishou/ui'")
    expect(dialog).toContain('Checkbox')
    expect(dialog).not.toContain('need_session_for_notebook')
    expect(stream).toContain('applyPendingNotebookMountToSession')
  })
})
