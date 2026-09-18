import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const registrySrc = readFileSync(join(dir, '../agent-workspace.ipc.ts'), 'utf8')
const filesSrc = readFileSync(join(dir, '../agent-workspace-files.ipc.ts'), 'utf8')
const gitSrc = readFileSync(join(dir, '../agent-workspace-git.ipc.ts'), 'utf8')
const fsUtilSrc = readFileSync(join(dir, '../agent-workspace-fs.util.ts'), 'utf8')

describe('agent workspace ipc split', () => {
  it('should register file and git channels from the workspace entry when booting', () => {
    expect(registrySrc).toContain('export function registerAgentWorkspaceIPC')
    expect(registrySrc).toContain('registerAgentWorkspaceFilesIPC()')
    expect(registrySrc).toContain('registerAgentWorkspaceGitIPC()')
  })

  it('should keep search and file io handlers in the files module when split', () => {
    expect(filesSrc).toContain("'agent-workspace:list-dir'")
    expect(filesSrc).toContain("'agent-workspace:read-file'")
    expect(filesSrc).toContain("'agent-workspace:search-files'")
    expect(filesSrc).toContain("'agent-workspace:replace-in-files'")
    expect(registrySrc).not.toContain("'agent-workspace:list-dir'")
    expect(registrySrc).not.toContain("'agent-workspace:search-files'")
  })

  it('should keep git handlers in the git module when split', () => {
    expect(gitSrc).toContain("'agent-workspace:git-is-initialized'")
    expect(gitSrc).toContain("'agent-workspace:git-commit-staged'")
    expect(registrySrc).not.toContain("'agent-workspace:git-is-initialized'")
    expect(fsUtilSrc).toContain('export function resolveWithinRoot')
  })
})
