import { logger } from '@baishou/shared'
import { GitPushError, GitPullError, GitRemoteNotConfiguredError, GitRollbackError } from './sync.errors'
import { GitSyncHistoryMixin } from './git-sync.history'

export abstract class GitSyncRemoteMixin extends GitSyncHistoryMixin {
  protected async ensureRemote(): Promise<void> {
    const url = this.config.remote?.url
    if (!url) throw new GitRemoteNotConfiguredError()

    const git = await this.ensureGit()
    const remotes = await git.getRemotes(true)
    const origin = remotes.find((r) => r.name === 'origin')

    const username = this.config.remote?.username
    const token = this.config.remote?.token
    const authenticatedUrl = this.getAuthenticatedUrl(url, username, token)

    if (!origin) {
      await git.remote(['add', 'origin', authenticatedUrl])
      logger.info(`[GitSync] 自动添加远程仓库: ${url}`)
    } else {
      const currentUrl = origin.refs.push
      if (currentUrl !== authenticatedUrl) {
        await git.remote(['set-url', 'origin', authenticatedUrl])
        logger.info(`[GitSync] 自动更新远程仓库: ${url}`)
      }
    }
  }

  async push(): Promise<void> {
    return this._withGitLock(async () => {
      await this.ensureRemote()

      try {
        const git = await this.ensureGit()
        const branch = this.config.remote!.branch || 'main'
        logger.info(`[GitSync] 推送至远程: origin/${branch}`)
        await git.push('origin', branch)
        logger.info('[GitSync] 推送成功')
      } catch (error) {
        logger.error(`[GitSync] 推送失败: ${error}`)
        throw new GitPushError(error instanceof Error ? error : undefined)
      }
    })
  }

  async pull(): Promise<void> {
    return this._withGitLock(async () => {
      await this.ensureRemote()

      try {
        const git = await this.ensureGit()
        const branch = this.config.remote!.branch || 'main'
        logger.info(`[GitSync] 从远程拉取: origin/${branch}`)
        await git.pull('origin', branch)
        logger.info('[GitSync] 拉取成功')
      } catch (error) {
        logger.error(`[GitSync] 拉取失败: ${error}`)
        const conflicts = await this.getConflicts()
        if (conflicts.length > 0) {
          throw new GitPullError(conflicts, error instanceof Error ? error : undefined)
        }
        throw new GitPullError(undefined, error instanceof Error ? error : undefined)
      }
    })
  }

  async hasConflicts(): Promise<boolean> {
    const conflicts = await this.getConflicts()
    return conflicts.length > 0
  }

  async getConflicts(): Promise<string[]> {
    try {
      const git = await this.ensureGit()
      const status = await git.status()
      return status.conflicted
    } catch {
      return []
    }
  }

  async resolveConflict(filePath: string, resolution: 'ours' | 'theirs'): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const git = await this.ensureGit()
        await git.raw(['checkout', `--${resolution}`, filePath])
        await git.add(filePath)
      } catch (error) {
        throw new GitRollbackError(error instanceof Error ? error : undefined)
      }
    })
  }
}
