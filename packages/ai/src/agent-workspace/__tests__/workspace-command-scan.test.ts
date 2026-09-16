import { describe, it, expect } from 'vitest'
// @ts-ignore - Node built-in, available at runtime
import { resolve } from 'node:path'
import { scanWorkspaceRunCommand } from '../workspace-command-scan'

const ROOT = resolve('/vault', 'workspace')

describe('scanWorkspaceRunCommand', () => {
  it('returns shell_command resource and prefix pattern', () => {
    const result = scanWorkspaceRunCommand({
      command: 'git status -sb',
      folderRoot: ROOT
    })

    expect(result.dangerous).toBe(false)
    expect(result.prefixPattern).toBe('git status *')
    expect(result.resources).toContainEqual({
      kind: 'shell_command',
      value: 'git status -sb'
    })
  })

  it('marks dangerous commands and force-exclusion candidates', () => {
    const result = scanWorkspaceRunCommand({
      command: 'rm -rf /',
      folderRoot: ROOT
    })
    expect(result.dangerous).toBe(true)
  })

  it('classifies relative workdir as workspace_path', () => {
    const result = scanWorkspaceRunCommand({
      command: 'node -e "console.log(1)"',
      workdir: 'src',
      folderRoot: ROOT
    })
    expect(result.resources).toContainEqual({ kind: 'workspace_path', value: 'src' })
  })

  it('classifies absolute workdir outside folderRoot as external_path', () => {
    const outside = resolve('/tmp', 'elsewhere')
    const result = scanWorkspaceRunCommand({
      command: 'echo hi',
      workdir: outside,
      folderRoot: ROOT
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(true)
  })

  it('classifies absolute path tokens inside workspace as workspace_path', () => {
    const inside = resolve(ROOT, 'notes', 'a.md')
    const result = scanWorkspaceRunCommand({
      command: `type "${inside}"`,
      folderRoot: ROOT
    })
    expect(result.resources).toContainEqual({
      kind: 'workspace_path',
      value: 'notes/a.md'
    })
  })

  it('classifies absolute path tokens outside workspace as external_path', () => {
    const outside = resolve('/etc', 'passwd')
    const result = scanWorkspaceRunCommand({
      command: `cat ${outside}`,
      folderRoot: ROOT
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(true)
  })

  it('does not treat Windows dir switches as external paths on win32', () => {
    const result = scanWorkspaceRunCommand({
      command: 'dir /a',
      workdir: '.',
      folderRoot: ROOT,
      platform: 'win32'
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(false)
  })

  it('does not treat Windows /all and /a:h switches as external paths on win32', () => {
    const result = scanWorkspaceRunCommand({
      command: 'ipconfig /all && dir /a:h',
      folderRoot: ROOT,
      platform: 'win32'
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(false)
  })

  it('still treats multi-segment Unix paths as external on win32', () => {
    const result = scanWorkspaceRunCommand({
      command: 'type /etc/passwd',
      folderRoot: ROOT,
      platform: 'win32'
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(true)
  })

  it('treats a single-segment Unix root token as external on linux', () => {
    const result = scanWorkspaceRunCommand({
      command: 'cat /a',
      folderRoot: ROOT,
      platform: 'linux'
    })
    expect(result.resources.some((r) => r.kind === 'external_path')).toBe(true)
  })
})
