import { describe, expect, it, vi } from 'vitest'
import { GitSyncServiceImpl } from '../git-sync.service'
import { createMockPathService } from './git-sync.test-helpers'

describe('GitSyncService', () => {
  describe('GitSyncServiceImpl - getWorkingDiff', () => {
    it('returns full content diff for untracked files', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const filePath = 'Journals/2026/05/2026-05-27.md'

      const mockGit = {
        status: vi.fn().mockResolvedValue({
          not_added: [filePath]
        }),
        diff: vi.fn()
      } as any

      ;(impl as any).git = mockGit
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'getGitRoot').mockResolvedValue('/mock/storage-root')

      const fs = await import('fs')
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('# New diary\n')

      const result = await impl.getWorkingDiff(filePath, false)

      expect(mockGit.diff).not.toHaveBeenCalled()
      expect(result.path).toBe(filePath)
      expect(result.hunks[0]?.content).toContain('+')
      expect(result.hunks[0]?.content).toContain('New diary')
    })
  })

  describe('GitSyncServiceImpl - getFileDiff', () => {
    it('falls back to git diff --root when parent diff is unavailable', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const filePath = 'Journals/2026/05/2026-05-27.md'
      const commitHash = 'abc1234'
      const rootDiff =
        'diff --git a/Journals/2026/05/2026-05-27.md b/Journals/2026/05/2026-05-27.md\n' +
        'new file mode 100644\n' +
        '@@ -0,0 +1,1 @@\n' +
        '+# New diary\n'

      const mockGit = {
        diff: vi.fn().mockRejectedValueOnce(new Error('no parent')).mockResolvedValueOnce(rootDiff)
      } as any

      ;(impl as any).git = mockGit
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      const result = await impl.getFileDiff(filePath, commitHash)

      expect(mockGit.diff).toHaveBeenLastCalledWith(['--root', commitHash, '--', filePath])
      expect(result.hunks.length).toBeGreaterThan(0)
      expect(result.hunks[0]?.content).toContain('+')
    })
  })

  describe('GitSyncServiceImpl - repairVaultGitlinks', () => {
    it('does not auto stage vault contents after removing gitlink', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const mockGit = {
        reset: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined)
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'getGitRoot').mockResolvedValue('/mock/storage-root')
      vi.spyOn(impl as any, 'listIndexedGitlinkPaths').mockResolvedValue(['VaultA'])
      vi.spyOn(impl as any, 'listVaultNestedGitDirs').mockResolvedValue([])
      vi.spyOn(impl as any, 'forceRemoveFromGitIndex').mockResolvedValue(true)

      const repaired = await (impl as any).repairVaultGitlinks(mockGit)

      expect(repaired).toBe(true)
      expect(mockGit.add).not.toHaveBeenCalled()
    })

    it('returns false when gitlink removal fails and nothing else changes', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const mockGit = {
        reset: vi.fn().mockResolvedValue(undefined),
        add: vi.fn().mockResolvedValue(undefined)
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'getGitRoot').mockResolvedValue('/mock/storage-root')
      vi.spyOn(impl as any, 'listIndexedGitlinkPaths').mockResolvedValue(['是'])
      vi.spyOn(impl as any, 'listVaultNestedGitDirs').mockResolvedValue([])
      vi.spyOn(impl as any, 'forceRemoveFromGitIndex').mockResolvedValue(false)

      const repaired = await (impl as any).repairVaultGitlinks(mockGit)

      expect(repaired).toBe(false)
      expect(mockGit.add).not.toHaveBeenCalled()
    })
  })

  describe('GitSyncServiceImpl - unstageAll', () => {
    it('uses mixed reset to clear the entire staging area', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const mockGit = {
        reset: vi.fn().mockResolvedValue(undefined)
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      await impl.unstageAll()

      expect(mockGit.reset).toHaveBeenCalledWith(['--mixed'])
    })
  })

  describe('GitSyncServiceImpl - getStatus', () => {
    it('should correctly map untracked files from not_added instead of created', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)

      const mockStatusResult = {
        files: [{ path: 'Journals/2026/05/2026-05-27.md', index: '?', working_dir: '?' }],
        created: [],
        not_added: ['Journals/2026/05/2026-05-27.md'],
        conflicted: [],
        isClean: () => false
      }

      const mockGit = {
        status: vi.fn().mockResolvedValue(mockStatusResult)
      } as any

      ;(impl as any).git = mockGit
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'maintainGitIndex').mockResolvedValue(undefined)
      vi.spyOn(impl as any, 'sanitizeGitIndex').mockResolvedValue(false)
      vi.spyOn(impl as any, 'repairVaultGitlinks').mockResolvedValue(false)

      const result = await impl.getStatus()

      expect(result.untracked).toEqual(['Journals/2026/05/2026-05-27.md'])
      expect(result.staged).toEqual([])
      expect(result.unstaged).toEqual([])
    })
  })

  describe('GitSyncServiceImpl - discardFile', () => {
    it('uses git clean for untracked files with normalized path matching', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const filePath = 'Journals/new.md'
      const mockGit = {
        status: vi.fn().mockResolvedValue({
          not_added: ['Journals\\new.md']
        }),
        clean: vi.fn().mockResolvedValue(undefined),
        checkout: vi.fn()
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      await impl.discardFile(filePath)

      expect(mockGit.clean).toHaveBeenCalledWith('f', ['--', filePath])
      expect(mockGit.checkout).not.toHaveBeenCalled()
    })
  })

  describe('GitSyncServiceImpl - addPathsToIndex', () => {
    it('falls back to per-file add when chunked add fails', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const paths = ['a.md', 'b.md']
      const mockGit = {
        add: vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue(undefined)
      } as any

      const staged = await (impl as any).addPathsToIndex(mockGit, paths)

      expect(staged).toBe(2)
      expect(mockGit.add).toHaveBeenCalledTimes(3)
    })

    it('uses git add . for large batches', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const paths = Array.from({ length: 40 }, (_, i) => `file-${i}.md`)
      const mockGit = {
        add: vi.fn().mockResolvedValue(undefined)
      } as any

      const staged = await (impl as any).addPathsToIndex(mockGit, paths)

      expect(staged).toBe(40)
      expect(mockGit.add).toHaveBeenCalledWith('.')
    })
  })

  describe('GitSyncServiceImpl - rollbackAll', () => {
    it('uses mixed reset without auto commit', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const mockGit = {
        raw: vi.fn().mockResolvedValue('')
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'sanitizeGitIndex').mockResolvedValue(false)
      vi.spyOn(impl as any, '_commitAll').mockResolvedValue(null)

      await impl.rollbackAll('abc1234')

      expect(mockGit.raw).toHaveBeenCalledWith(['reset', '--mixed', 'abc1234'])
      expect((impl as any)._commitAll).not.toHaveBeenCalled()
    })
  })

  describe('GitSyncServiceImpl - rollbackFile', () => {
    it('restores to worktree only without auto commit', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      const filePath = 'Journals/2026/05/13.md'
      const mockGit = {
        raw: vi.fn().mockResolvedValue('')
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'getGitRoot').mockResolvedValue('/mock/storage-root')
      vi.spyOn(impl as any, '_commitAll').mockResolvedValue(null)

      await impl.rollbackFile(filePath, 'abc1234')

      expect(mockGit.raw).toHaveBeenCalledWith([
        'restore',
        '--source',
        'abc1234~1',
        '--worktree',
        '--',
        filePath
      ])
      expect((impl as any)._commitAll).not.toHaveBeenCalled()
    })
  })

  describe('GitSyncServiceImpl - getRollbackAllContext', () => {
    it('reports remote, dirty state, and commits after target', async () => {
      const mockPathService = createMockPathService()

      const impl = new GitSyncServiceImpl(mockPathService)
      ;(impl as any).config = {
        remote: { url: 'https://github.com/user/repo.git', branch: 'main' }
      }

      const mockGit = {
        status: vi.fn().mockResolvedValue({ isClean: () => false }),
        raw: vi.fn().mockResolvedValue('3\n')
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      const context = await impl.getRollbackAllContext('abc1234')

      expect(context).toEqual({
        hasRemote: true,
        hasUncommittedChanges: true,
        commitsAfterTarget: 3
      })
    })
  })
})
