import { logger } from '@baishou/shared'
import type { GitRemoteStatus } from '@baishou/shared'
import type { SimpleGit } from 'simple-git'
import {
  GitPushError,
  GitPullError,
  GitRemoteNotConfiguredError,
  GitRollbackError
} from './sync.errors'
import { parseLeftRightCount } from './git-sync.helpers'
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

  private remoteBranchName(): string {
    return this.config.remote?.branch || 'main'
  }

  private async hasUpstream(git: SimpleGit): Promise<boolean> {
    try {
      const upstream = (await git.revparse(['--abbrev-ref', '--symbolic-full-name', '@{u}'])).trim()
      return Boolean(upstream)
    } catch {
      return false
    }
  }

  private async readAheadBehind(
    git: SimpleGit,
    branch: string
  ): Promise<{ ahead: number; behind: number; unpublished: boolean }> {
    try {
      const counts = (
        await git.raw(['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`])
      ).trim()
      return { ...parseLeftRightCount(counts), unpublished: false }
    } catch {
      return { ahead: 0, behind: 0, unpublished: true }
    }
  }

  async getRemoteStatus(options?: { fetch?: boolean }): Promise<GitRemoteStatus> {
    await this.loadConfig()
    const branch = this.remoteBranchName()
    const remoteUrl = this.config.remote?.url?.trim()
    const initialized = await this.isInitialized()

    if (!remoteUrl) {
      return {
        configured: false,
        connected: false,
        unpublished: true,
        branch,
        ahead: 0,
        behind: 0
      }
    }

    if (!initialized) {
      return {
        configured: true,
        connected: false,
        unpublished: true,
        branch,
        remoteUrl,
        ahead: 0,
        behind: 0
      }
    }

    return this._withGitLock(async () => {
      await this.ensureRemote()
      const git = await this.ensureGit()
      let connected = false
      let fetchError: string | undefined

      if (options?.fetch) {
        try {
          await git.fetch(['origin'])
          connected = true
        } catch (error) {
          connected = false
          fetchError = error instanceof Error ? error.message : String(error)
        }
      }

      const { ahead, behind, unpublished } = await this.readAheadBehind(git, branch)
      if (!options?.fetch) {
        connected = !unpublished
      }

      return {
        configured: true,
        connected,
        unpublished,
        branch,
        remoteUrl,
        ahead,
        behind,
        fetchError
      }
    })
  }

  private async pushUnlocked(): Promise<void> {
    await this.ensureRemote()
    const git = await this.ensureGit()
    const branch = this.remoteBranchName()
    logger.info(`[GitSync] 推送至远程: origin/${branch}`)
    const hasUpstream = await this.hasUpstream(git)
    if (hasUpstream) {
      await git.push('origin', branch)
    } else {
      await git.push(['-u', 'origin', branch])
    }
    logger.info('[GitSync] 推送成功')
  }

  private async pullUnlocked(): Promise<void> {
    await this.ensureRemote()
    const git = await this.ensureGit()
    const branch = this.remoteBranchName()
    logger.info(`[GitSync] 从远程拉取: origin/${branch}`)
    try {
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
  }

  async push(): Promise<void> {
    return this._withGitLock(async () => {
      try {
        await this.pushUnlocked()
      } catch (error) {
        if (error instanceof GitRemoteNotConfiguredError) throw error
        logger.error(`[GitSync] 推送失败: ${error}`)
        throw new GitPushError(error instanceof Error ? error : undefined)
      }
    })
  }

  async pull(): Promise<void> {
    return this._withGitLock(async () => {
      try {
        await this.pullUnlocked()
      } catch (error) {
        if (error instanceof GitRemoteNotConfiguredError || error instanceof GitPullError) {
          throw error
        }
        logger.error(`[GitSync] 拉取失败: ${error}`)
        throw new GitPullError(undefined, error instanceof Error ? error : undefined)
      }
    })
  }

  async syncRemote(): Promise<void> {
    return this._withGitLock(async () => {
      await this.ensureRemote()
      const git = await this.ensureGit()
      const branch = this.remoteBranchName()

      try {
        await git.fetch(['origin'])
      } catch (error) {
        logger.error(`[GitSync] 同步远程时 fetch 失败: ${error}`)
        throw new GitPullError(undefined, error instanceof Error ? error : undefined)
      }

      const { behind, unpublished } = await this.readAheadBehind(git, branch)
      if (!unpublished && behind > 0) {
        await this.pullUnlocked()
      }

      try {
        await this.pushUnlocked()
      } catch (error) {
        if (error instanceof GitRemoteNotConfiguredError || error instanceof GitPullError) {
          throw error
        }
        logger.error(`[GitSync] 同步远程时推送失败: ${error}`)
        throw new GitPushError(error instanceof Error ? error : undefined)
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
