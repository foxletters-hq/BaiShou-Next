import { describe, it, expect } from 'vitest'
import { buildWorkspaceEnvLines } from '../workspace-env.util'

describe('buildWorkspaceEnvLines', () => {
  it('includes cwd / platform / git / notebook', () => {
    const lines = buildWorkspaceEnvLines({
      folderRoot: 'D:/proj',
      platform: 'win32',
      isGitRepo: true,
      gitBranch: 'main',
      gitChangesCount: 3,
      notebookId: 'nb'
    })
    expect(lines.join('\n')).toContain('Working directory: D:/proj')
    expect(lines.join('\n')).toContain('Platform: win32')
    expect(lines.join('\n')).toContain('Git branch: main')
    expect(lines.join('\n')).toContain('Git changes count: 3')
    expect(lines.join('\n')).toContain('notebookId: nb')
  })
})
