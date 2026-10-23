import { describe, expect, it } from 'vitest'
import { GitSyncServiceImpl } from '../git-sync.service'

describe('GitSyncService', () => {
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
      expect(
        unquoteGitPath('"\\345\\260\\217\\350\\257\\264\\350\\247\\204\\350\\214\\203.md"')
      ).toBe('小说规范.md')
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

  describe('isTextDiffablePath', () => {
    it('allows markdown and blocks images or directory-like paths', async () => {
      const { isTextDiffablePath } = await import('../git-sync.helpers')
      expect(isTextDiffablePath('Personal/Journals/2026/05/13.md')).toBe(true)
      expect(isTextDiffablePath('Personal/attachments/photo.png')).toBe(false)
      expect(isTextDiffablePath('是')).toBe(false)
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
      expect(parseGitHistoryLog('abc1234deadbeef\x1f第一页\x1f2026-08-01T00:00:00.000Z')).toEqual([
        {
          hash: 'abc1234deadbeef',
          message: '第一页',
          date: '2026-08-01T00:00:00.000Z'
        }
      ])
      expect(parseGitHistoryLog('')).toEqual([])
    })
  })
})
