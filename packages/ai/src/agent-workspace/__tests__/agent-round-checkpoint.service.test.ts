import { describe, it, expect, beforeEach } from 'vitest'
import { AgentRoundCheckpointService } from '../agent-round-checkpoint.service'
import type { WorkspaceFsAdapter } from '../workspace-fs'
// @ts-ignore - Node built-in, available at runtime
import { resolve } from 'node:path'

function createMemoryFs(): WorkspaceFsAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>()

  return {
    files,
    async exists(absolutePath: string) {
      return files.has(absolutePath)
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
      const prefix = absolutePath.endsWith('/') ? absolutePath : `${absolutePath}/`
      const names = new Set<string>()
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const segment = rest.split('/')[0]
        if (segment) names.add(segment)
      }
      return [...names].map((name) => ({
        name,
        isDirectory: [...files.keys()].some(
          (key) => key.startsWith(`${prefix}${name}/`) && key !== `${prefix}${name}`
        )
      }))
    }
  }
}

const ROOT = resolve('/vault', 'project')

describe('AgentRoundCheckpointService', () => {
  let fs: ReturnType<typeof createMemoryFs>
  let service: AgentRoundCheckpointService

  beforeEach(() => {
    fs = createMemoryFs()
    service = new AgentRoundCheckpointService(fs)
  })

  it('captures before state for existing and missing files', async () => {
    fs.files.set(resolve(ROOT, 'README.md'), '# Title')

    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: ['README.md', 'new.txt']
    })

    expect(checkpoint.files).toHaveLength(2)
    expect(checkpoint.files.find((entry) => entry.path === 'README.md')?.existed).toBe(true)
    expect(checkpoint.files.find((entry) => entry.path === 'new.txt')?.existed).toBe(false)
    expect(checkpoint.files.find((entry) => entry.path === 'README.md')?.beforeContent).toBe(
      '# Title'
    )
  })

  it('restores modified and created files on rollback', async () => {
    fs.files.set(resolve(ROOT, 'README.md'), 'before')

    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: ['README.md', 'new.txt']
    })

    fs.files.set(resolve(ROOT, 'README.md'), 'after')
    fs.files.set(resolve(ROOT, 'new.txt'), 'created')

    const result = await service.rollback(checkpoint.id, ROOT)

    expect(result.restored).toContain('README.md')
    expect(result.deleted).toContain('new.txt')
    expect(fs.files.get(resolve(ROOT, 'README.md'))).toBe('before')
    expect(fs.files.has(resolve(ROOT, 'new.txt'))).toBe(false)
  })

  it('FS-01: rollback deletes newly created files instead of leaving empty ghosts', async () => {
    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: ['ghost.ts']
    })

    fs.files.set(resolve(ROOT, 'ghost.ts'), 'export const implemented = true')
    const result = await service.rollback(checkpoint.id, ROOT)

    expect(result.deleted).toContain('ghost.ts')
    expect(fs.files.has(resolve(ROOT, 'ghost.ts'))).toBe(false)
  })

  it('CP-cascade: rolling back earlier round also undoes later round disk edits', async () => {
    // Round 1: create a.ts
    const cp1 = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u1',
      folderRoot: ROOT,
      paths: ['a.ts']
    })
    fs.files.set(resolve(ROOT, 'a.ts'), 'v1')

    // Round 2: create b.ts and mutate a.ts
    const cp2 = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u2',
      folderRoot: ROOT,
      paths: ['a.ts', 'b.ts']
    })
    fs.files.set(resolve(ROOT, 'a.ts'), 'v2')
    fs.files.set(resolve(ROOT, 'b.ts'), 'from-round-2')

    // Round 3: create c.ts
    const cp3 = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u3',
      folderRoot: ROOT,
      paths: ['c.ts']
    })
    fs.files.set(resolve(ROOT, 'c.ts'), 'from-round-3')

    // Rollback to round 1 (cascade u3 → u2 → u1)
    const result = await service.cascadeRollback([cp1, cp2, cp3], ROOT)

    expect(fs.files.has(resolve(ROOT, 'a.ts'))).toBe(false)
    expect(fs.files.has(resolve(ROOT, 'b.ts'))).toBe(false)
    expect(fs.files.has(resolve(ROOT, 'c.ts'))).toBe(false)
    expect(result.deleted).toEqual(expect.arrayContaining(['a.ts', 'b.ts', 'c.ts']))
  })

  it('CP-cascade: restores shared file to state before the target round', async () => {
    fs.files.set(resolve(ROOT, 'README.md'), 'before')

    const cp1 = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u1',
      folderRoot: ROOT,
      paths: ['README.md']
    })
    fs.files.set(resolve(ROOT, 'README.md'), 'after-r1')

    const cp2 = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u2',
      folderRoot: ROOT,
      paths: ['README.md']
    })
    fs.files.set(resolve(ROOT, 'README.md'), 'after-r2')

    await service.cascadeRollback([cp1, cp2], ROOT)
    expect(fs.files.get(resolve(ROOT, 'README.md'))).toBe('before')
  })

  it('restores deleted files on rollback', async () => {
    fs.files.set(resolve(ROOT, 'notes.md'), 'keep me')

    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: ['notes.md']
    })

    fs.files.delete(resolve(ROOT, 'notes.md'))
    const result = await service.rollback(checkpoint.id, ROOT)

    expect(result.restored).toContain('notes.md')
    expect(fs.files.get(resolve(ROOT, 'notes.md'))).toBe('keep me')
  })

  it('ensures late-discovered paths are captured before mutation', async () => {
    fs.files.set(resolve(ROOT, 'late.md'), 'original')

    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: []
    })

    await service.ensurePathCaptured(checkpoint.id, ROOT, 'late.md')
    fs.files.set(resolve(ROOT, 'late.md'), 'mutated')

    const result = await service.rollback(checkpoint.id, ROOT)
    expect(result.restored).toContain('late.md')
    expect(fs.files.get(resolve(ROOT, 'late.md'))).toBe('original')
  })

  it('lists checkpoints by session id', async () => {
    const first = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'msg-1',
      folderRoot: ROOT,
      paths: []
    })
    await service.capturePaths({
      sessionId: 'sess-2',
      userMessageId: 'msg-2',
      folderRoot: ROOT,
      paths: []
    })

    expect(service.getCheckpoint(first.id)?.sessionId).toBe('sess-1')
    expect(service.getCheckpointsForSession('sess-1')).toHaveLength(1)
  })

  it('restores checkpoint from external store', () => {
    const checkpoint = {
      id: 'cp-1',
      sessionId: 's1',
      userMessageId: 'u1',
      createdAt: new Date().toISOString(),
      files: []
    }
    service.restoreCheckpoint(checkpoint)
    expect(service.getCheckpoint('cp-1')).toEqual(checkpoint)
  })

  it('removes checkpoints by user message ids', async () => {
    const first = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u1',
      folderRoot: ROOT,
      paths: ['a.ts']
    })
    const second = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u2',
      folderRoot: ROOT,
      paths: ['b.ts']
    })
    await service.capturePaths({
      sessionId: 'sess-2',
      userMessageId: 'u3',
      folderRoot: ROOT,
      paths: ['c.ts']
    })

    const removed = service.removeCheckpointsForUserMessages('sess-1', ['u1', 'u2'])
    expect(removed).toEqual(expect.arrayContaining([first.id, second.id]))
    expect(service.getCheckpointsForSession('sess-1')).toHaveLength(0)
    expect(service.getCheckpointsForSession('sess-2')).toHaveLength(1)
    expect(service.removeCheckpoint(first.id)).toBe(false)
  })

  it('removeCheckpoint deletes a single in-memory checkpoint by id', async () => {
    const checkpoint = await service.capturePaths({
      sessionId: 'sess-1',
      userMessageId: 'u1',
      folderRoot: ROOT,
      paths: ['a.ts']
    })

    expect(service.getCheckpoint(checkpoint.id)?.id).toBe(checkpoint.id)
    expect(service.removeCheckpoint(checkpoint.id)).toBe(true)
    expect(service.getCheckpoint(checkpoint.id)).toBeUndefined()
    expect(service.removeCheckpoint(checkpoint.id)).toBe(false)
  })
})
