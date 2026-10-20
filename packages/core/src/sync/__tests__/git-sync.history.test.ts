import { describe, expect, it, vi } from 'vitest'
import { GitSyncServiceImpl } from '../git-sync.service'
import { createMockPathService } from './git-sync.test-helpers'

describe('GitSyncService', () => {
  describe('GitSyncServiceImpl - getHistory pagination', () => {
    it('passes max-count and skip via git raw without loading per-commit diffs', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('aaaaaaaaaaaaaaaa'),
        raw: vi.fn().mockResolvedValue('bbbbbbbbbbbbbbbb\x1folder\x1f2026-08-01T00:00:00.000Z'),
        diffSummary: vi.fn()
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      const entries = await impl.getHistory(undefined, 10, 20)

      expect(mockGit.raw).toHaveBeenCalledWith([
        'log',
        '--max-count=10',
        '--skip=20',
        '--format=%H%x1f%s%x1f%aI'
      ])
      expect(mockGit.diffSummary).not.toHaveBeenCalled()
      expect(entries).toHaveLength(1)
      expect(entries[0]?.commit.hash).toBe('bbbbbbb')
      expect(entries[0]?.changes).toEqual([])
    })

    it('appends file path after skip when filtering history', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('aaaaaaaaaaaaaaaa'),
        raw: vi.fn().mockResolvedValue('')
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      await impl.getHistory('Journals/a.md', 20, 20)

      expect(mockGit.raw).toHaveBeenCalledWith([
        'log',
        '--max-count=20',
        '--skip=20',
        '--format=%H%x1f%s%x1f%aI',
        '--',
        'Journals/a.md'
      ])
    })
  })

  describe('GitSyncServiceImpl - getHistoryCount', () => {
    it('parses rev-list count output', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      const mockGit = {
        raw: vi.fn().mockResolvedValue('warning: extra\n25\n')
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      await expect(impl.getHistoryCount()).resolves.toBe(25)
      expect(mockGit.raw).toHaveBeenCalledWith(['rev-list', '--count', 'HEAD'])
    })
  })

  describe('GitSyncServiceImpl - getRemoteStatus', () => {
    it('returns unconfigured status when remote url is missing', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      vi.spyOn(impl as any, 'loadConfig').mockResolvedValue(undefined)
      vi.spyOn(impl, 'isInitialized').mockResolvedValue(true)
      ;(impl as any).config = { enabled: true }

      const status = await impl.getRemoteStatus()
      expect(status).toMatchObject({
        configured: false,
        connected: false,
        unpublished: true,
        ahead: 0,
        behind: 0
      })
    })

    it('reads ahead and behind after fetch', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      vi.spyOn(impl as any, 'loadConfig').mockResolvedValue(undefined)
      vi.spyOn(impl, 'isInitialized').mockResolvedValue(true)
      vi.spyOn(impl as any, 'ensureRemote').mockResolvedValue(undefined)
      const mockGit = {
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue('1\t2')
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      ;(impl as any).config = {
        enabled: true,
        remote: { url: 'https://example.com/user/vault.git', branch: 'main' }
      }

      const status = await impl.getRemoteStatus({ fetch: true })
      expect(mockGit.fetch).toHaveBeenCalledWith(['origin'])
      expect(status).toMatchObject({
        configured: true,
        connected: true,
        unpublished: false,
        ahead: 2,
        behind: 1,
        remoteUrl: 'https://example.com/user/vault.git'
      })
    })
  })

  describe('GitSyncServiceImpl - syncRemote', () => {
    it('fetches, pulls when behind, then pushes', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      vi.spyOn(impl as any, 'ensureRemote').mockResolvedValue(undefined)
      const mockGit = {
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockResolvedValue('2\t0'),
        pull: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue(undefined),
        revparse: vi.fn().mockResolvedValue('origin/main')
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      ;(impl as any).config = {
        enabled: true,
        remote: { url: 'https://example.com/user/vault.git', branch: 'main' }
      }

      await impl.syncRemote()

      expect(mockGit.fetch).toHaveBeenCalledWith(['origin'])
      expect(mockGit.pull).toHaveBeenCalledWith('origin', 'main')
      expect(mockGit.push).toHaveBeenCalled()
    })

    it('skips pull when the remote branch does not exist yet', async () => {
      const impl = new GitSyncServiceImpl(createMockPathService())
      vi.spyOn(impl as any, 'ensureRemote').mockResolvedValue(undefined)
      const mockGit = {
        fetch: vi.fn().mockResolvedValue(undefined),
        raw: vi.fn().mockRejectedValue(new Error('unknown revision')),
        pull: vi.fn(),
        push: vi.fn().mockResolvedValue(undefined),
        revparse: vi.fn().mockRejectedValue(new Error('no upstream'))
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      ;(impl as any).config = {
        enabled: true,
        remote: { url: 'https://example.com/user/vault.git', branch: 'main' }
      }

      await impl.syncRemote()

      expect(mockGit.pull).not.toHaveBeenCalled()
      expect(mockGit.push).toHaveBeenCalledWith(['-u', 'origin', 'main'])
    })
  })
})
