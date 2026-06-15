import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IGitSyncService } from '../git-sync.interface'
import type { GitCommit, GitSyncConfig, VersionHistoryEntry } from '@baishou/shared'
import { GitSyncServiceImpl } from '../git-sync.service'
import {
  GitInitError,
  GitCommitError,
  GitPushError,
  GitPullError,
  GitRemoteNotConfiguredError,
  GitRollbackError
} from '../sync.errors'

describe('GitSyncService', () => {
  let service: IGitSyncService

  beforeEach(() => {
    // Mock 实现将在实现阶段替换
    service = {
      init: vi.fn(),
      isInitialized: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      testRemoteConnection: vi.fn(),
      commit: vi.fn(),
      commitAll: vi.fn(),
      commitStaged: vi.fn(),
      getHistory: vi.fn(),
      getCommitChanges: vi.fn(),
      getFileDiff: vi.fn(),
      rollbackFile: vi.fn(),
      rollbackAll: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      hasConflicts: vi.fn(),
      getConflicts: vi.fn(),
      resolveConflict: vi.fn()
    } as unknown as IGitSyncService
  })

  describe('init', () => {
    it('should initialize git repository successfully', async () => {
      vi.mocked(service.init).mockResolvedValue(undefined)

      await expect(service.init()).resolves.toBeUndefined()
      expect(service.init).toHaveBeenCalledOnce()
    })

    it('should throw GitInitError when initialization fails', async () => {
      const cause = new Error('git init failed')
      vi.mocked(service.init).mockRejectedValue(new GitInitError(cause))

      await expect(service.init()).rejects.toThrow(GitInitError)
    })
  })

  describe('isInitialized', () => {
    it('should return true when repository exists', async () => {
      vi.mocked(service.isInitialized).mockResolvedValue(true)

      const result = await service.isInitialized()
      expect(result).toBe(true)
    })

    it('should return false when repository does not exist', async () => {
      vi.mocked(service.isInitialized).mockResolvedValue(false)

      const result = await service.isInitialized()
      expect(result).toBe(false)
    })
  })

  describe('getConfig', () => {
    it('should return current git sync config', async () => {
      const config: GitSyncConfig = {
        enabled: true
      }
      vi.mocked(service.getConfig).mockResolvedValue(config)

      const result = await service.getConfig()
      expect(result).toEqual(config)
    })
  })

  describe('updateConfig', () => {
    it('should update config with partial values', async () => {
      vi.mocked(service.updateConfig).mockResolvedValue(undefined)

      await expect(service.updateConfig({ enabled: true })).resolves.toBeUndefined()
      expect(service.updateConfig).toHaveBeenCalledWith({ enabled: true })
    })
  })

  describe('commit', () => {
    it('should commit specified files with message', async () => {
      const commit: GitCommit = {
        hash: 'def5678',
        message: '更新日记',
        date: new Date(),
        files: ['Journals/2026/05/2026-05-13.md']
      }
      vi.mocked(service.commit).mockResolvedValue(commit)

      const result = await service.commit(['Journals/2026/05/2026-05-13.md'], '更新日记')
      expect(result).toEqual(commit)
    })

    it('should throw GitCommitError when commit fails', async () => {
      vi.mocked(service.commit).mockRejectedValue(new GitCommitError())

      await expect(service.commit(['file.md'], 'test')).rejects.toThrow(GitCommitError)
    })
  })

  describe('getHistory', () => {
    it('should return version history for specific file', async () => {
      const history: VersionHistoryEntry[] = [
        {
          commit: {
            hash: 'abc1234',
            message: '更新日记',
            date: new Date(),
            files: ['Journals/2026/05/2026-05-13.md']
          },
          changes: [
            {
              path: 'Journals/2026/05/2026-05-13.md',
              status: 'modified',
              additions: 5,
              deletions: 2
            }
          ],
          isCurrent: true
        }
      ]
      vi.mocked(service.getHistory).mockResolvedValue(history)

      const result = await service.getHistory('Journals/2026/05/2026-05-13.md')
      expect(result).toEqual(history)
    })

    it('should return global history when no file specified', async () => {
      vi.mocked(service.getHistory).mockResolvedValue([])

      const result = await service.getHistory()
      expect(result).toEqual([])
    })

    it('should respect limit parameter', async () => {
      vi.mocked(service.getHistory).mockResolvedValue([])

      await service.getHistory(undefined, 10)
      expect(service.getHistory).toHaveBeenCalledWith(undefined, 10)
    })
  })

  describe('rollbackFile', () => {
    it('should rollback file to specified version', async () => {
      vi.mocked(service.rollbackFile).mockResolvedValue(undefined)

      await expect(
        service.rollbackFile('Journals/2026/05/2026-05-13.md', 'abc1234')
      ).resolves.toBeUndefined()
    })

    it('should throw GitRollbackError when rollback fails', async () => {
      vi.mocked(service.rollbackFile).mockRejectedValue(new GitRollbackError())

      await expect(service.rollbackFile('file.md', 'abc1234')).rejects.toThrow(GitRollbackError)
    })
  })

  describe('push', () => {
    it('should push to remote successfully', async () => {
      vi.mocked(service.push).mockResolvedValue(undefined)

      await expect(service.push()).resolves.toBeUndefined()
    })

    it('should throw GitRemoteNotConfiguredError when remote not configured', async () => {
      vi.mocked(service.push).mockRejectedValue(new GitRemoteNotConfiguredError())

      await expect(service.push()).rejects.toThrow(GitRemoteNotConfiguredError)
    })

    it('should throw GitPushError when push fails', async () => {
      vi.mocked(service.push).mockRejectedValue(new GitPushError())

      await expect(service.push()).rejects.toThrow(GitPushError)
    })
  })

  describe('pull', () => {
    it('should pull from remote successfully', async () => {
      vi.mocked(service.pull).mockResolvedValue(undefined)

      await expect(service.pull()).resolves.toBeUndefined()
    })

    it('should throw GitPullError with conflicts when pull has conflicts', async () => {
      const conflicts = ['Journals/2026/05/2026-05-13.md']
      vi.mocked(service.pull).mockRejectedValue(new GitPullError(conflicts))

      await expect(service.pull()).rejects.toThrow(GitPullError)
    })
  })

  describe('hasConflicts', () => {
    it('should return true when there are conflicts', async () => {
      vi.mocked(service.hasConflicts).mockResolvedValue(true)

      const result = await service.hasConflicts()
      expect(result).toBe(true)
    })

    it('should return false when there are no conflicts', async () => {
      vi.mocked(service.hasConflicts).mockResolvedValue(false)

      const result = await service.hasConflicts()
      expect(result).toBe(false)
    })
  })

  describe('resolveConflict', () => {
    it('should resolve conflict with ours', async () => {
      vi.mocked(service.resolveConflict).mockResolvedValue(undefined)

      await expect(service.resolveConflict('file.md', 'ours')).resolves.toBeUndefined()
    })

    it('should resolve conflict with theirs', async () => {
      vi.mocked(service.resolveConflict).mockResolvedValue(undefined)

      await expect(service.resolveConflict('file.md', 'theirs')).resolves.toBeUndefined()
    })
  })

  describe('GitSyncServiceImpl helper - getAuthenticatedUrl', () => {
    it('should inject username and password correctly in HTTPS URL', () => {
      const impl = new GitSyncServiceImpl({} as any)
      const getAuthenticatedUrl = (impl as any).getAuthenticatedUrl.bind(impl)

      expect(getAuthenticatedUrl('https://github.com/user/repo.git', 'admin', 'pass')).toBe(
        'https://admin:pass@github.com/user/repo.git'
      )

      expect(getAuthenticatedUrl('https://github.com/user/repo.git', 'admin')).toBe(
        'https://admin@github.com/user/repo.git'
      )

      expect(getAuthenticatedUrl('https://github.com/user/repo.git', undefined, 'token123')).toBe(
        'https://token123@github.com/user/repo.git'
      )
    })

    it('should clean existing credentials in HTTPS URL', () => {
      const impl = new GitSyncServiceImpl({} as any)
      const getAuthenticatedUrl = (impl as any).getAuthenticatedUrl.bind(impl)

      expect(
        getAuthenticatedUrl('https://old:oldpass@github.com/user/repo.git', 'new', 'newpass')
      ).toBe('https://new:newpass@github.com/user/repo.git')
    })

    it('should keep original URL if not HTTP/HTTPS', () => {
      const impl = new GitSyncServiceImpl({} as any)
      const getAuthenticatedUrl = (impl as any).getAuthenticatedUrl.bind(impl)

      expect(getAuthenticatedUrl('git@github.com:user/repo.git', 'admin', 'pass')).toBe(
        'git@github.com:user/repo.git'
      )
    })

    it('should inject username and password correctly in HTTP URL', () => {
      const impl = new GitSyncServiceImpl({} as any)
      const getAuthenticatedUrl = (impl as any).getAuthenticatedUrl.bind(impl)

      expect(getAuthenticatedUrl('http://github.com/user/repo.git', 'admin', 'pass')).toBe(
        'http://admin:pass@github.com/user/repo.git'
      )
    })
  })

  describe('isExcludedFromVersionControl', () => {
    it('excludes nested vault .baishou paths and root sync metadata', async () => {
      const { isExcludedFromVersionControl } = await import('../git-sync.helpers')

      expect(isExcludedFromVersionControl('Personal/Journals/a.md')).toBe(false)
      expect(isExcludedFromVersionControl('Personal/.baishou/settings/x.json')).toBe(true)
      expect(isExcludedFromVersionControl('.baishou/manifest.json')).toBe(true)
      expect(isExcludedFromVersionControl('.baishou-s3.json')).toBe(true)
      expect(isExcludedFromVersionControl('.baishou-git.json')).toBe(true)
      expect(isExcludedFromVersionControl('Personal/.git.vault-legacy/config')).toBe(true)
      expect(
        isExcludedFromVersionControl('Personal/.git.vault-legacy/hooks/commit-msg.sample')
      ).toBe(true)
    })
  })

  describe('parseGitlinkPathFromLsFilesLine', () => {
    it('parses gitlink entries from ls-files -s output', async () => {
      const { parseGitlinkPathFromLsFilesLine } = await import('../git-sync.helpers')
      expect(parseGitlinkPathFromLsFilesLine('160000 abc123 0\tPersonal')).toBe('Personal')
      expect(parseGitlinkPathFromLsFilesLine('100644 abc123 0\tfoo.md')).toBeNull()
    })

    it('decodes quoted non-ascii gitlink paths from ls-files -s output', async () => {
      const { parseGitlinkPathFromLsFilesLine } = await import('../git-sync.helpers')
      expect(parseGitlinkPathFromLsFilesLine('160000 abc123 0\t"\\346\\230\\257"')).toBe('是')
    })
  })

  describe('unquoteGitPath', () => {
    it('decodes git-style quoted paths', async () => {
      const { unquoteGitPath } = await import('../git-sync.helpers')
      expect(unquoteGitPath('"\\346\\230\\257"')).toBe('是')
      expect(unquoteGitPath('plain/path.md')).toBe('plain/path.md')
    })
  })

  describe('parseDiffHunks', () => {
    it('falls back to raw diff body when no @@ hunks exist', async () => {
      const { parseDiffHunks } = await import('../git-sync.helpers')
      const diff = 'diff --git a/Personal b/Personal\n--- a/Personal\n+++ b/Personal\n'
      const hunks = parseDiffHunks(diff)
      expect(hunks).toHaveLength(1)
      expect(hunks[0]?.content).toContain('diff --git')
    })
  })

  describe('buildNewFileDiffHunks', () => {
    it('builds all-addition hunks for new file content', async () => {
      const { buildNewFileDiffHunks } = await import('../git-sync.helpers')
      const hunks = buildNewFileDiffHunks('hello\nworld\n')
      expect(hunks).toHaveLength(1)
      expect(hunks[0]).toMatchObject({
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 2
      })
      expect(hunks[0]?.content).toBe('+hello\n+world')
    })
  })

  describe('GitSyncServiceImpl - getWorkingDiff', () => {
    it('returns full content diff for untracked files', async () => {
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

      const impl = new GitSyncServiceImpl(mockPathService)
      const filePath = 'Journals/2026/05/2026-05-27.md'
      const commitHash = 'abc1234'
      const rootDiff =
        'diff --git a/Journals/2026/05/2026-05-27.md b/Journals/2026/05/2026-05-27.md\n' +
        'new file mode 100644\n' +
        '@@ -0,0 +1,1 @@\n' +
        '+# New diary\n'

      const mockGit = {
        diff: vi
          .fn()
          .mockRejectedValueOnce(new Error('no parent'))
          .mockResolvedValueOnce(rootDiff)
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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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

  describe('isTextDiffablePath', () => {
    it('allows markdown and blocks images or directory-like paths', async () => {
      const { isTextDiffablePath } = await import('../git-sync.helpers')
      expect(isTextDiffablePath('Personal/Journals/2026/05/13.md')).toBe(true)
      expect(isTextDiffablePath('Personal/attachments/photo.png')).toBe(false)
      expect(isTextDiffablePath('是')).toBe(false)
    })
  })

  describe('GitSyncServiceImpl - getStatus', () => {
    it('should correctly map untracked files from not_added instead of created', async () => {
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
})
