import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import type { FileChange, FileDiff, VersionHistoryEntry } from '@baishou/shared'
import type { SimpleGit } from 'simple-git'
import { GitRollbackError } from './sync.errors'
import { GitSyncCommitMixin } from './git-sync.commit'
import { mapStatusToType, parseDiffHunks } from './git-sync.helpers'

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
    const git = await this.ensureGit()

    const args = commitHash
      ? [`${commitHash}~1`, commitHash, '--', filePath]
      : ['HEAD~1', 'HEAD', '--', filePath]

    try {
      const diff = await git.diff(args)
      return { path: filePath, hunks: parseDiffHunks(diff) }
    } catch {
      return { path: filePath, hunks: [] }
    }
  }

  async getWorkingDiff(filePath: string, staged: boolean): Promise<FileDiff> {
    const git = await this.ensureGit()
    const args = staged ? ['--cached', '--', filePath] : ['--', filePath]

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
        const vaultPath = await this.getVaultPath()
        const fullPath = path.join(vaultPath, filePath)
        logger.info(`[GitSync] 回滚文件: ${filePath} <- ${commitHash}~1`)

        let restored = false
        try {
          await git.raw(['restore', '--source', `${commitHash}~1`, '--', filePath])
          logger.info(`[GitSync] 回滚成功(已恢复): ${filePath}`)
          restored = true
        } catch {
          logger.info(`[GitSync] ${filePath} 在旧版本不存在，执行删除`)
          try {
            if (fs.existsSync(fullPath)) {
              await fs.promises.unlink(fullPath)
              logger.info(`[GitSync] 回滚成功(已删除): ${filePath}`)
              restored = true
            }
          } catch (unlinkErr) {
            logger.error(`[GitSync] 删除文件失败: ${unlinkErr}`)
          }
        }

        if (!restored) {
          throw new Error(`无法回滚 ${filePath}: 文件在此版本前后均不存在`)
        }

        await this._commitAll(`回滚文件: ${filePath} ← ${commitHash}`).catch((e) => {
          logger.warn(`[GitSync] 回滚自动提交失败:`, e as any)
        })
      } catch (error) {
        logger.error(`[GitSync] 回滚失败 ${filePath}: ${error}`)
        throw new GitRollbackError(error instanceof Error ? error : undefined)
      }
    })
  }

  async rollbackAll(commitHash: string): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const git = await this.ensureGit()
        logger.info(`[GitSync] 回滚仓库: ${commitHash}`)

        try {
          await git.raw(['checkout', commitHash, '--', '.'])
          logger.info(`[GitSync] 仓库回滚成功: ${commitHash}`)
        } catch (checkoutErr: any) {
          const msg = checkoutErr?.message || ''
          if (msg.includes('unable to unlink') || msg.includes('Invalid argument')) {
            logger.warn(`[GitSync] 整体回滚遇到锁定文件，改为逐文件回滚`)
            await this.rollbackAllFileByFile(git, commitHash)
          } else {
            throw checkoutErr
          }
        }

        await this._commitAll(`回滚整仓库到: ${commitHash}`).catch((e) => {
          logger.warn(`[GitSync] 回滚自动提交失败:`, e as any)
        })
      } catch (error) {
        logger.error(`[GitSync] 仓库回滚失败: ${error}`)
        throw new GitRollbackError(error instanceof Error ? error : undefined)
      }
    })
  }

  protected async rollbackAllFileByFile(git: SimpleGit, commitHash: string): Promise<void> {
    const diff = await git.diffSummary([`${commitHash}~1`, commitHash])
    let failCount = 0

    for (const file of diff.files) {
      try {
        await git.raw(['checkout', commitHash, '--', file.file])
      } catch {
        failCount++
        logger.warn(`[GitSync] 跳过无法回滚的文件: ${file.file}`)
      }
    }

    logger.info(`[GitSync] 逐文件回滚完成，跳过 ${failCount} 个锁定文件`)
  }
}
