import { beforeEach, describe, expect, it } from 'vitest'
// @ts-ignore - Node built-in
import { resolve } from 'node:path'
import {
  prepareWorkspacePatchGate,
  prepareWorkspaceWriteGate,
  WorkspaceGateStaleError
} from '../workspace-gate-preview'
import type { WorkspaceFsAdapter } from '../workspace-fs'
import { hashWorkspaceContent } from '../workspace-fs'
import {
  assertRegisteredWorkspaceGateFreshness,
  clearWorkspaceGateFreshnessForTests
} from '../workspace-gate-freshness.registry'

const ROOT = resolve('/vault', 'workspace')
const SESSION = 'sess_preview'

function createMemoryFs(): WorkspaceFsAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    async exists(absolutePath) {
      return files.has(resolve(absolutePath))
    },
    async readFile(absolutePath) {
      return files.get(resolve(absolutePath)) ?? null
    },
    async writeFile(absolutePath, content) {
      files.set(resolve(absolutePath), content)
    },
    async deleteFile(absolutePath) {
      files.delete(resolve(absolutePath))
    },
    async rename(from, to) {
      const content = files.get(resolve(from))
      if (content == null) throw new Error('missing')
      files.delete(resolve(from))
      files.set(resolve(to), content)
    },
    async listDir() {
      return []
    }
  }
}

describe('workspace-gate-preview', () => {
  beforeEach(() => {
    clearWorkspaceGateFreshnessForTests()
  })

  it('prepares write preview with real hunks for modify', async () => {
    const fs = createMemoryFs()
    await fs.writeFile(resolve(ROOT, 'src/a.ts'), 'line1\nline2\nline3\n')
    const prepared = await prepareWorkspaceWriteGate(
      { path: 'src/a.ts', content: 'line1\nline2-changed\nline3\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )

    expect(prepared).not.toBeNull()
    expect(prepared!.preview.type).toBe('file_change')
    if (prepared!.preview.type !== 'file_change') return
    expect(prepared!.preview.kind).toBe('modify')
    expect(prepared!.preview.additions).toBe(1)
    expect(prepared!.preview.deletions).toBe(1)
    expect(prepared!.preview.diff).toContain('-line2')
    expect(prepared!.preview.diff).toContain('+line2-changed')
    expect(prepared!.preview.diff).toContain(' line1')
  })

  it('returns null for patch when old_text is missing (no ask card)', async () => {
    const fs = createMemoryFs()
    await fs.writeFile(resolve(ROOT, 'a.txt'), 'hello\n')
    const prepared = await prepareWorkspacePatchGate(
      { path: 'a.txt', old_text: 'missing', new_text: 'x' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    expect(prepared).toBeNull()
  })

  it('fails verify when file content changes while waiting', async () => {
    const fs = createMemoryFs()
    const abs = resolve(ROOT, 'a.txt')
    await fs.writeFile(abs, 'original\n')
    const prepared = await prepareWorkspaceWriteGate(
      { path: 'a.txt', content: 'next\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    expect(prepared?.verifyBeforeExecute).toBeTypeOf('function')
    await fs.writeFile(abs, 'tampered\n')
    await expect(prepared!.verifyBeforeExecute!()).rejects.toBeInstanceOf(WorkspaceGateStaleError)
    expect(hashWorkspaceContent('tampered\n')).not.toBe(hashWorkspaceContent('original\n'))
  })

  it('passes verify when file is unchanged', async () => {
    const fs = createMemoryFs()
    await fs.writeFile(resolve(ROOT, 'a.txt'), 'original\n')
    const prepared = await prepareWorkspaceWriteGate(
      { path: 'a.txt', content: 'next\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    await expect(prepared!.verifyBeforeExecute!()).resolves.toBeUndefined()
  })

  it('registers freshness token so execute-time assert catches mid-wait edits', async () => {
    const fs = createMemoryFs()
    const abs = resolve(ROOT, 'a.txt')
    await fs.writeFile(abs, 'original\n')
    const prepared = await prepareWorkspaceWriteGate(
      { path: 'a.txt', content: 'next\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    expect(prepared?.freshnessToken).toBeTruthy()
    await fs.writeFile(abs, 'tampered\n')
    await expect(
      assertRegisteredWorkspaceGateFreshness({
        token: prepared!.freshnessToken,
        fs,
        requireRegistration: true
      })
    ).rejects.toBeInstanceOf(WorkspaceGateStaleError)
  })

  it('keeps independent freshness tokens for concurrent prepares on same path', async () => {
    const fs = createMemoryFs()
    const abs = resolve(ROOT, 'a.txt')
    await fs.writeFile(abs, 'original\n')
    const first = await prepareWorkspaceWriteGate(
      { path: 'a.txt', content: 'first\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    const second = await prepareWorkspaceWriteGate(
      { path: 'a.txt', content: 'second\n' },
      { sessionId: SESSION, workspace: { folderRoot: ROOT, fs } }
    )
    expect(first?.freshnessToken).toBeTruthy()
    expect(second?.freshnessToken).toBeTruthy()
    expect(first!.freshnessToken).not.toBe(second!.freshnessToken)
    await expect(
      assertRegisteredWorkspaceGateFreshness({
        token: first!.freshnessToken,
        fs,
        requireRegistration: true
      })
    ).resolves.toBeUndefined()
    await expect(
      assertRegisteredWorkspaceGateFreshness({
        token: second!.freshnessToken,
        fs,
        requireRegistration: true
      })
    ).resolves.toBeUndefined()
  })
})
