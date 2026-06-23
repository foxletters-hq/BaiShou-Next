import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolContext } from '../../tools/agent.tool'
import type { WorkspaceFsAdapter } from '../workspace-fs'
import {
  WorkspaceDeleteTool,
  WorkspaceListTool,
  WorkspacePatchTool,
  WorkspaceReadTool,
  WorkspaceRenameTool,
  WorkspaceWriteTool
} from '../workspace.tools'
import { resolveAgentGateToolMetadata } from '../../baishou-agent-gate/agent-gate-tool-metadata'
import { AgentGateRiskLevel } from '@baishou/shared'
// @ts-ignore - Node built-in, available at runtime
import { resolve, sep } from 'node:path'

function directoryPrefix(absolutePath: string): string {
  const normalized = resolve(absolutePath)
  return normalized.endsWith(sep) ? normalized : `${normalized}${sep}`
}

function createMemoryFs(): WorkspaceFsAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>()

  return {
    files,
    async exists(absolutePath: string) {
      const target = resolve(absolutePath)
      if (files.has(target)) return true
      const prefix = directoryPrefix(target)
      for (const key of files.keys()) {
        if (resolve(key).startsWith(prefix)) return true
      }
      return false
    },
    async readFile(absolutePath: string) {
      return files.has(absolutePath) ? files.get(absolutePath)! : null
    },
    async writeFile(absolutePath: string, content: string) {
      files.set(absolutePath, content)
    },
    async deleteFile(absolutePath: string) {
      files.delete(absolutePath)
    },
    async rename(from: string, to: string) {
      const content = files.get(from)
      if (content == null) throw new Error('missing source')
      files.delete(from)
      files.set(to, content)
    },
    async listDir(absolutePath: string) {
      const prefix = directoryPrefix(absolutePath)
      const entries = new Map<string, boolean>()

      for (const key of files.keys()) {
        const resolvedKey = resolve(key)
        if (resolvedKey === resolve(absolutePath)) continue
        if (!resolvedKey.startsWith(prefix)) continue
        const rest = resolvedKey.slice(prefix.length)
        const [name, ...restParts] = rest.split(sep)
        if (!name) continue
        const isDirectory = restParts.length > 0 || key.endsWith('/')
        entries.set(name, entries.get(name) || isDirectory)
      }

      return [...entries.entries()].map(([name, isDirectory]) => ({ name, isDirectory }))
    }
  }
}

const ROOT = resolve('/vault', 'workspace')

function workspaceContext(
  fs: WorkspaceFsAdapter,
  extras?: Partial<NonNullable<ToolContext['workspace']>>
): ToolContext {
  return {
    sessionId: 'sess-workspace',
    vaultName: 'Personal',
    workspace: {
      folderRoot: ROOT,
      sessionKind: 'workspace',
      fs,
      roundCheckpointId: 'chk-1',
      ...extras
    }
  }
}

describe('workspace tools', () => {
  let fs: ReturnType<typeof createMemoryFs>

  beforeEach(() => {
    fs = createMemoryFs()
  })

  it('lists workspace files and directories', async () => {
    fs.files.set(resolve(ROOT, 'README.md'), '# Hello')
    fs.files.set(resolve(ROOT, 'src', 'index.ts'), 'export {}')

    const result = await new WorkspaceListTool().execute({}, workspaceContext(fs))
    expect(result).toContain('[file] README.md')
    expect(result).toContain('[dir] src')
  })

  it('reads file content with optional offset and limit', async () => {
    fs.files.set(resolve(ROOT, 'notes.md'), 'one\ntwo\nthree\n')

    const tool = new WorkspaceReadTool()
    const full = await tool.execute({ path: 'notes.md' }, workspaceContext(fs))
    expect(full).toContain('one')
    expect(full).toContain('three')

    const slice = await tool.execute({ path: 'notes.md', offset: 1, limit: 1 }, workspaceContext(fs))
    expect(slice).toContain('two')
    expect(slice).not.toContain('one')
  })

  it('creates and overwrites files while emitting file_change', async () => {
    const onFileChange = vi.fn()
    const writeTool = new WorkspaceWriteTool()

    const created = await writeTool.execute(
      { path: 'new.txt', content: 'hello\n' },
      workspaceContext(fs, { onFileChange })
    )
    expect(created).toContain('Successfully created')
    expect(fs.files.get(resolve(ROOT, 'new.txt'))).toBe('hello\n')
    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'new.txt', kind: 'create' })
    )

    const updated = await writeTool.execute(
      { path: 'new.txt', content: 'hello\nworld\n' },
      workspaceContext(fs, { onFileChange })
    )
    expect(updated).toContain('Successfully updated')
    expect(onFileChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'new.txt', kind: 'modify' })
    )
  })

  it('patches file content with exact text replacement', async () => {
    fs.files.set(resolve(ROOT, 'app.ts'), 'const value = 1;\n')
    const onFileChange = vi.fn()

    const result = await new WorkspacePatchTool().execute(
      { path: 'app.ts', old_text: 'const value = 1;', new_text: 'const value = 2;' },
      workspaceContext(fs, { onFileChange })
    )

    expect(result).toContain('Successfully patched')
    expect(fs.files.get(resolve(ROOT, 'app.ts'))).toBe('const value = 2;\n')
    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'app.ts', kind: 'modify' })
    )
  })

  it('deletes files and reports missing paths', async () => {
    fs.files.set(resolve(ROOT, 'temp.txt'), 'bye')
    const onFileChange = vi.fn()

    const ok = await new WorkspaceDeleteTool().execute(
      { path: 'temp.txt' },
      workspaceContext(fs, { onFileChange })
    )
    expect(ok).toContain('Successfully deleted')
    expect(fs.files.has(resolve(ROOT, 'temp.txt'))).toBe(false)
    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'temp.txt', kind: 'delete' })
    )

    const missing = await new WorkspaceDeleteTool().execute(
      { path: 'missing.txt' },
      workspaceContext(fs)
    )
    expect(missing).toContain('File not found')
  })

  it('renames files within the workspace', async () => {
    fs.files.set(resolve(ROOT, 'old.md'), 'content')
    const onFileChange = vi.fn()

    const result = await new WorkspaceRenameTool().execute(
      { path: 'old.md', new_path: 'new.md' },
      workspaceContext(fs, { onFileChange })
    )

    expect(result).toContain('Successfully renamed')
    expect(fs.files.has(resolve(ROOT, 'old.md'))).toBe(false)
    expect(fs.files.get(resolve(ROOT, 'new.md'))).toBe('content')
    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'new.md', kind: 'rename', previousPath: 'old.md' })
    )
  })

  it('rejects path traversal attempts', async () => {
    const result = await new WorkspaceReadTool().execute(
      { path: '../../outside.txt' },
      workspaceContext(fs)
    )
    expect(result).toContain('Path escapes workspace root')
  })

  it('requires workspace configuration', async () => {
    const result = await new WorkspaceReadTool().execute(
      { path: 'README.md' },
      { sessionId: 'sess', vaultName: 'Personal' }
    )
    expect(result).toContain('Workspace is not configured')
  })
})

describe('workspace gate metadata', () => {
  it('registers gate metadata for mutating workspace tools', () => {
    expect(resolveAgentGateToolMetadata('workspace_write')?.riskLevel).toBe(
      AgentGateRiskLevel.Mutating
    )
    expect(resolveAgentGateToolMetadata('workspace_patch')?.riskLevel).toBe(
      AgentGateRiskLevel.Mutating
    )
    expect(resolveAgentGateToolMetadata('workspace_delete')?.riskLevel).toBe(
      AgentGateRiskLevel.Destructive
    )
    expect(resolveAgentGateToolMetadata('workspace_rename')?.riskLevel).toBe(
      AgentGateRiskLevel.Mutating
    )
    expect(resolveAgentGateToolMetadata('workspace_read')).toBeUndefined()
    expect(resolveAgentGateToolMetadata('workspace_list')).toBeUndefined()
  })
})
