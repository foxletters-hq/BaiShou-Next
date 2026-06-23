import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import { GitInitError } from './sync.errors'
import { GitSyncInternalBase } from './git-sync.internal'

export abstract class GitSyncInitMixin extends GitSyncInternalBase {
  async init(): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const gitRoot = await this.getGitRoot()
        logger.info(`[GitSync] 正在初始化 Git 仓库（全部工作区）: ${gitRoot}`)
        const git = await this.ensureGit()
        await git.init()
        await this.ensureGitignore()
        await this.ensureAuthorIdentity(git)

        await git.add('.gitignore')
        try {
          await git.commit('初始化 Git 版本管理')
        } catch (commitErr) {
          logger.warn('[GitSync] 初始提交失败:', commitErr as any)
        }

        if (this.config.remote?.url) {
          const authenticatedUrl = this.getAuthenticatedUrl(
            this.config.remote.url,
            this.config.remote.username,
            this.config.remote.token
          )
          try {
            await git.remote(['add', 'origin', authenticatedUrl])
          } catch {}
        }

        logger.info(`[GitSync] Git 仓库初始化成功: ${gitRoot}`)
      } catch (error) {
        logger.error(`[GitSync] Git 仓库初始化失败: ${error}`)
        throw new GitInitError(error instanceof Error ? error : undefined)
      }
    })
  }

  async isInitialized(): Promise<boolean> {
    try {
      const gitRoot = await this.getGitRoot()
      return fs.existsSync(path.join(gitRoot, '.git'))
    } catch {
      return false
    }
  }
}
