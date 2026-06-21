import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import type {
  FileChange,
  FileDiff,
  GitRollbackAllContext,
  VersionHistoryEntry
} from '@baishou/shared'
import type { SimpleGit } from 'simple-git'
import { GitRollbackError } from './sync.errors'
import { GitSyncCommitMixin } from './git-sync.commit'
import {
  buildNewFileDiffHunks,
  isTextDiffablePath,
  mapStatusToType,
  parseDiffHunks,
  pathsEqual
} from './git-sync.helpers'

export abstract class GitSyncHistoryMixin extends GitSyncCommitMixin {
  async getHistory(filePath?: string, limit = 50): Promise<VersionHistoryEntry[]> {
    const git = await this.ensureGit()

    const options = ['--max-count', String(limit)]
    if (filePath) {
      options.push('--', filePath)
    }

    try {
      const log = await git.log(options)
      const entries: VersionHistoryEntry[] = []
      for (const commit of log.all) {
        const changes = await this.getCommitChanges(commit.hash)
        entries.push({
          commit: {
            hash: commit.hash.substring(0, 7),
            message: commit.message,
            date: new Date(commit.date),
            files: changes.map((c) => c.path)
          },
          changes,
          isCurrent: entries.length === 0
        })
      }
      return entries
    } catch {
      return []
    }
  }

  async getRecentPulls(limit = 10): Promise<VersionHistoryEntry[]> {
    const git = await this.ensureGit()
    try {
      const branch = this.config.remote?.branch || 'main'
      const log = await git.log([`origin/${branch}`, '--max-count', String(limit)])
      const entries: VersionHistoryEntry[] = []
      for (const commit of log.all) {
        entries.push({
          commit: {
            hash: commit.hash.substring(0, 7),
            message: commit.message,
            date: new Date(commit.date),
            files: []
          },
          changes: [],
          isCurrent: false
        })
      }
      return entries
    } catch {
      return []
    }
  }

  async getCommitChanges(commitHash: string): Promise<FileChange[]> {
    const git = await this.ensureGit()
    try {
      const diff = await git.diffSummary([`${commitHash}~1`, commitHash])

      return diff.files.map((file) => ({
        path: file.file,
        status: mapStatusToType((file as { status?: string }).status ?? 'M'),
        additions: 'insertions' in file ? file.insertions : 0,
        deletions: 'deletions' in file ? file.deletions : 0
      }))
    } catch {
      try {
        const diff = await git.diffSummary([commitHash])
        return diff.files.map((file) => ({
          path: file.file,
          status: 'added' as FileChange['status'],
          additions: 'insertions' in file ? file.insertions : 0,
          deletions: 'deletions' in file ? file.deletions : 0
        }))
      } catch {
        return []
      }
    }
  }

  async getFileDiff(filePath: string, commitHash?: string): Promise<FileDiff> {
    if (!isTextDiffablePath(filePath)) {
      return { path: filePath, hunks: [] }
    }

    const git = await this.ensureGit()

    const toFileDiff = (diff: string): FileDiff => ({
      path: filePath,
      hunks: parseDiffHunks(diff)
    })

    if (commitHash) {
      try {
        const diff = await git.diff([`${commitHash}~1`, commitHash, '--', filePath])
        if (diff.trim()) {
          return toFileDiff(diff)
        }
      } catch {
        // 可能是首次提交（无父 commit），回退到 git show
      }

      try {
        const diff = await git.diff(['--root', commitHash, '--', filePath])
        if (diff.trim()) {
          return toFileDiff(diff)
        }
      } catch {
        return { path: filePath, hunks: [] }
      }

      return { path: filePath, hunks: [] }
    }

    try {
      const diff = await git.diff(['HEAD~1', 'HEAD', '--', filePath])
      return toFileDiff(diff)
    } catch {
      return { path: filePath, hunks: [] }
    }
  }

  async getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff> {
    if (!isTextDiffablePath(filePath)) {
      return { path: filePath, hunks: [] }
    }

    const git = await this.ensureGit()

    if (!staged) {
      const status = await git.status()
      const isUntracked = status.not_added.some((p) => pathsEqual(p, filePath))
      if (isUntracked) {
        try {
          const gitRoot = await this.getGitRoot()
          const fullPath = path.join(gitRoot, filePath)
          const content = await fs.promises.readFile(fullPath, 'utf8')
          return { path: filePath, hunks: buildNewFileDiffHunks(content) }
        } catch {
          return { path: filePath, hunks: [] }
        }
      }
    }

    const args = staged
      ? ['--cached', '--submodule=short', '--', filePath]
      : ['--submodule=short', '--', filePath]

    try {
      const diff = await git.diff(args)
      return { path: filePath, hunks: parseDiffHunks(diff) }
    } catch {
      return { path: filePath, hunks: [] }
    }
  }

  async rollbackFile(filePath: string, commitHash: string): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const git = await this.ensureGit()
        const gitRoot = await this.getGitRoot()
        const fullPath = path.join(gitRoot, filePath)
        logger.info(`[GitSync] 软回滚文件: ${filePath}（撤销提交 ${commitHash} 的改动）`)

        let restored = false
        try {
          await git.raw(['restore', '--source', `${commitHash}~1`, '--worktree', '--', filePath])
          logger.info(`[GitSync] 回滚成功(已恢复至工作区): ${filePath}`)
          restored = true
        } catch {
          logger.info(`[GitSync] ${filePath} 在旧版本不存在，执行删除`)
          try {
            if (fs.existsSync(fullPath)) {
              await fs.promises.unlink(fullPath)
              logger.info(`[GitSync] 回滚成功(已从工作区删除): ${filePath}`)
              restored = true
            }
          } catch (unlinkErr) {
            logger.error(`[GitSync] 删除文件失败: ${unlinkErr}`)
          }
        }

        if (!restored) {
          throw new Error(`无法回滚 ${filePath}: 文件在此版本前后均不存在`)
        }
      } catch (error) {
        logger.error(`[GitSync] 回滚失败 ${filePath}: ${error}`)
        throw new GitRollbackError(error instanceof Error ? error : undefined)
      }
    })
  }

  async getRollbackAllContext(targetCommitHash: string): Promise<GitRollbackAllContext> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      const status = await git.status()
      let commitsAfterTarget = 0
      try {
        const count = await git.raw(['rev-list', '--count', `${targetCommitHash}..HEAD`])
        commitsAfterTarget = Math.max(0, parseInt(count.trim(), 10) || 0)
      } catch {
        commitsAfterTarget = 0
      }

      return {
        hasRemote: Boolean(this.config.remote?.url),
        hasUncommittedChanges: !status.isClean(),
        commitsAfterTarget
      }
    })
  }

  async rollbackAll(commitHash: string): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const git = await this.ensureGit()
        logger.info(`[GitSync] 软回滚仓库到: ${commitHash}（后续提交将保留为未提交变更）`)
        // mixed reset：HEAD 移到目标提交，其后所有改动留在工作区（未暂存）
        await git.reset(['--mixed', commitHash])
        await this.sanitizeGitIndex(git)
        logger.info(`[GitSync] 仓库已回滚到 ${commitHash}，后续变更已进入工作区`)
      } catch (error) {
        logger.error(`[GitSync] 仓库回滚失败: ${error}`)
        throw new GitRollbackError(error instanceof Error ? error : undefined)
      }
    })
  }
}
