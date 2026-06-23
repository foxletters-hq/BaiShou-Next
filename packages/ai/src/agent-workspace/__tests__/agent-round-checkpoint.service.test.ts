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
})
