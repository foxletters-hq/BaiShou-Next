import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { rollbackWorkspaceAll } from '@baishou/core-desktop'

const dir = dirname(fileURLToPath(import.meta.url))
const serviceSource = readFileSync(
  join(dir, '../../../../../../packages/core-desktop/src/workspace-folder-git.service.ts'),
  'utf8'
)

describe('workspace folder git rollbackAll', () => {
  it('should mixed-reset so later commits stay as working-tree changes', async () => {
    const git = { reset: vi.fn().mockResolvedValue('') }
    await rollbackWorkspaceAll(git as never, 'abc1234')
    expect(git.reset).toHaveBeenCalledWith(['--mixed', 'abc1234'])
    expect(git.reset).not.toHaveBeenCalledWith(expect.arrayContaining(['--hard']))
  })

  it('should wire the workbench git service to mixed reset instead of hard reset', () => {
    expect(serviceSource).toContain('rollbackWorkspaceAll')
    expect(serviceSource).not.toContain("reset(['--hard', commitHash])")
  })
})
