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
      await expect(service.init()).rejects.toThrow('git init failed')
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
      expect(
        isExcludedFromVersionControl('Personal/Attachments/x/全栈开发.conflict-1781599201371.pdf')
      ).toBe(true)
      expect(
        isExcludedFromVersionControl(
          'Personal/Attachments/x/file.conflict-1.conflict-2.conflict-3.pdf'
        )
      ).toBe(true)
      expect(isExcludedFromVersionControl('.write_test_1782499969450_zzldj')).toBe(true)
      expect(isExcludedFromVersionControl('.baishou_write_test')).toBe(true)
    })
  })

  describe('isStorageWriteProbePath', () => {
    it('detects storage write probe filenames', async () => {
      const { isStorageWriteProbePath } = await import('../git-sync.helpers')
      expect(isStorageWriteProbePath('.write_test')).toBe(true)
      expect(isStorageWriteProbePath('.write_test_1782499969450_zzldj')).toBe(true)
      expect(isStorageWriteProbePath('Personal/.baishou_write_test')).toBe(true)
      expect(isStorageWriteProbePath('Personal/Journals/a.md')).toBe(false)
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

    it('decodes unquoted octal-escaped paths from diff --numstat', async () => {
      const { unquoteGitPath } = await import('../git-sync.helpers')
      expect(unquoteGitPath('\\345\\260\\217\\350\\257\\264.md')).toBe('小说.md')
      expect(unquoteGitPath('"\\345\\260\\217\\350\\257\\264\\350\\247\\204\\350\\214\\203.md"')).toBe(
        '小说规范.md'
      )
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

  describe('GitSyncServiceImpl - unstageAll', () => {
    it('uses mixed reset to clear the entire staging area', async () => {
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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

  describe('GitSyncServiceImpl - discardFile', () => {
    it('uses git clean for untracked files with normalized path matching', async () => {
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

      const impl = new GitSyncServiceImpl(mockPathService)
      const mockGit = {
        reset: vi.fn().mockResolvedValue(undefined)
      } as any

      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)
      vi.spyOn(impl as any, 'sanitizeGitIndex').mockResolvedValue(false)
      vi.spyOn(impl as any, '_commitAll').mockResolvedValue(null)

      await impl.rollbackAll('abc1234')

      expect(mockGit.reset).toHaveBeenCalledWith(['--mixed', 'abc1234'])
      expect((impl as any)._commitAll).not.toHaveBeenCalled()
    })
  })

  describe('GitSyncServiceImpl - rollbackFile', () => {
    it('restores to worktree only without auto commit', async () => {
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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
      const mockPathService = {
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any

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

  describe('GitSyncServiceImpl - getHistory pagination', () => {
    it('passes max-count and skip via git raw without loading per-commit diffs', async () => {
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('aaaaaaaaaaaaaaaa'),
        raw: vi.fn().mockResolvedValue(
          'bbbbbbbbbbbbbbbb\x1folder\x1f2026-08-01T00:00:00.000Z'
        ),
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
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
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
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
      const mockGit = {
        raw: vi.fn().mockResolvedValue('warning: extra\n25\n')
      }
      vi.spyOn(impl as any, 'ensureGit').mockResolvedValue(mockGit)

      await expect(impl.getHistoryCount()).resolves.toBe(25)
      expect(mockGit.raw).toHaveBeenCalledWith(['rev-list', '--count', 'HEAD'])
    })
  })

  describe('parseLeftRightCount', () => {
    it('parses tab-separated behind and ahead counts', async () => {
      const { parseLeftRightCount } = await import('../git-sync.helpers')
      expect(parseLeftRightCount('2\t3')).toEqual({ behind: 2, ahead: 3 })
      expect(parseLeftRightCount('0 1')).toEqual({ behind: 0, ahead: 1 })
      expect(parseLeftRightCount('')).toEqual({ behind: 0, ahead: 0 })
    })
  })

  describe('parseRevListCount', () => {
    it('reads the last integer line and ignores warnings', async () => {
      const { parseRevListCount } = await import('../git-sync.helpers')
      expect(parseRevListCount('25\n')).toBe(25)
      expect(parseRevListCount('warning: refname HEAD is ambiguous\n40')).toBe(40)
      expect(parseRevListCount('')).toBe(0)
    })
  })

  describe('parseGitHistoryLog', () => {
    it('splits hash, subject and date with unit separator', async () => {
      const { parseGitHistoryLog } = await import('../git-sync.helpers')
      expect(
        parseGitHistoryLog('abc1234deadbeef\x1f第一页\x1f2026-08-01T00:00:00.000Z')
      ).toEqual([
        {
          hash: 'abc1234deadbeef',
          message: '第一页',
          date: '2026-08-01T00:00:00.000Z'
        }
      ])
      expect(parseGitHistoryLog('')).toEqual([])
    })
  })

  describe('GitSyncServiceImpl - getRemoteStatus', () => {
    it('returns unconfigured status when remote url is missing', async () => {
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
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
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
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
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
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
      const impl = new GitSyncServiceImpl({
        getRootDirectory: vi.fn().mockResolvedValue('/mock/storage-root')
      } as any)
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
