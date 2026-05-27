import { logger } from '@baishou/shared'
import type { GitCommit, GitSyncConfig } from '@baishou/shared'
import { GitCommitError } from './sync.errors'
import { GitSyncWorkspaceMixin } from './git-sync.workspace'

export abstract class GitSyncCommitMixin extends GitSyncWorkspaceMixin {
  async getConfig(): Promise<GitSyncConfig> {
    await this.loadConfig()
    return { ...this.config }
  }

  async updateConfig(config: Partial<GitSyncConfig>): Promise<void> {
    const oldRemoteUrl = this.config.remote?.url
    const oldUsername = this.config.remote?.username
    const oldToken = this.config.remote?.token
    const oldUserName = this.config.userName
    const oldUserEmail = this.config.userEmail

    this.config = { ...this.config, ...config }
    await this.saveConfig()

    try {
      const git = await this.ensureGit()

      if (this.config.userName !== oldUserName) {
        if (this.config.userName) {
          await git.addConfig('user.name', this.config.userName)
        } else {
          try {
            await git.raw(['config', '--unset', 'user.name'])
          } catch {}
        }
      }
      if (this.config.userEmail !== oldUserEmail) {
        if (this.config.userEmail) {
          await git.addConfig('user.email', this.config.userEmail)
        } else {
          try {
            await git.raw(['config', '--unset', 'user.email'])
          } catch {}
        }
      }

      const newRemoteUrl = this.config.remote?.url
      const newUsername = this.config.remote?.username
      const newToken = this.config.remote?.token

      if (oldRemoteUrl !== newRemoteUrl || oldUsername !== newUsername || oldToken !== newToken) {
        const remotes = await git.getRemotes(true)
        const hasOrigin = remotes.some((r) => r.name === 'origin')

        if (newRemoteUrl) {
          const authenticatedUrl = this.getAuthenticatedUrl(newRemoteUrl, newUsername, newToken)
          if (hasOrigin) {
            await git.remote(['set-url', 'origin', authenticatedUrl])
            logger.info(
              `[GitSync] 已更新远程仓库: ${newRemoteUrl} (已配凭据: ${!!(newUsername || newToken)})`
            )
          } else {
            await git.remote(['add', 'origin', authenticatedUrl])
            logger.info(
              `[GitSync] 已添加远程仓库: ${newRemoteUrl} (已配凭据: ${!!(newUsername || newToken)})`
            )
          }
        } else if (hasOrigin) {
          await git.remote(['remove', 'origin'])
          logger.info('[GitSync] 已移除远程仓库')
        }
      }
    } catch (e) {
      logger.warn(`[GitSync] 仓库配置更新或同步失败:`, e as any)
    }
  }

  async testRemoteConnection(): Promise<boolean> {
    if (!this.config.remote?.url) {
      return false
    }

    try {
      const git = await this.ensureGit()
      await git.listRemote([this.config.remote.url])
      return true
    } catch {
      return false
    }
  }

  async commitAll(message: string): Promise<GitCommit | null> {
    return this._withGitLock(() => this._commitAll(message))
  }

  async commitStaged(message: string): Promise<GitCommit | null> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      await this.untrackBaishouFiles(git)
      const stagedPaths = this.filterVersionedPaths(await this.getCachedPaths(git))
      if (stagedPaths.length === 0) {
        return null
      }

      logger.info(`[GitSync] 提交 ${stagedPaths.length} 个已暂存文件`)
      try {
        const result = await git.commit(message)
        return {
          hash: result.commit,
          message,
          date: new Date(),
          files: stagedPaths
        }
      } catch (error) {
        throw new GitCommitError(error instanceof Error ? error : undefined)
      }
    })
  }

  protected async _commitAll(message: string): Promise<GitCommit | null> {
    const git = await this.ensureGit()

    try {
      await this.ensureGitignore()
      await this.untrackBaishouFiles(git)

      let stagedPaths = this.filterVersionedPaths(await this.getCachedPaths(git))
      if (stagedPaths.length === 0) {
        logger.info('[GitSync] 无暂存文件，自动暂存 Changes 中的变更')
        await this.stagePendingChanges(git)
        stagedPaths = this.filterVersionedPaths(await this.getCachedPaths(git))
      }

      if (stagedPaths.length === 0) {
        return null
      }

      logger.info(`[GitSync] 提交 ${stagedPaths.length} 个文件`)
      const result = await git.commit(message)

      return {
        hash: result.commit,
        message,
        date: new Date(),
        files: stagedPaths
      }
    } catch (error) {
      throw new GitCommitError(error instanceof Error ? error : undefined)
    }
  }

  async commit(files: string[], message: string): Promise<GitCommit> {
    return this._withGitLock(async () => {
      try {
        const git = await this.ensureGit()
        await git.add(files)
        const result = await git.commit(message)

        return {
          hash: result.commit,
          message,
          date: new Date(),
          files
        }
      } catch (error) {
        throw new GitCommitError(error instanceof Error ? error : undefined)
      }
    })
  }
}
