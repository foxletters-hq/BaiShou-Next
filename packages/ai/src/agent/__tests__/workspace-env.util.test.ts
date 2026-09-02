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
      notebookIds: ['nb']
    })
    expect(lines.join('\n')).toContain('Working directory: D:/proj')
    expect(lines.join('\n')).toContain('Platform: win32')
    expect(lines.join('\n')).toContain('Git branch: main')
    expect(lines.join('\n')).toContain('Git changes count: 3')
    expect(lines.join('\n')).toContain('Mounted knowledge notebooks (1/3): nb')
    expect(lines.join('\n')).toContain('companion_ask')
  })

  it('lists every mounted notebook and forbids inventing sources when none are mounted', () => {
    const mounted = buildWorkspaceEnvLines({
      folderRoot: 'D:/proj',
      platform: 'win32',
      notebookIds: ['nb-a', 'nb-b'],
      notebookNames: { 'nb-a': '制度', 'nb-b': '手册' }
    })
    expect(mounted.join('\n')).toContain('制度')
    expect(mounted.join('\n')).toContain('手册')

    const empty = buildWorkspaceEnvLines({
      folderRoot: 'D:/proj',
      platform: 'win32'
    })
    expect(empty.join('\n')).toMatch(/No knowledge notebook is mounted/)
  })
})
