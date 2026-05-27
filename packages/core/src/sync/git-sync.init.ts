import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@baishou/shared'
import { GitInitError } from './sync.errors'
import { GitSyncInternalBase } from './git-sync.internal'

export abstract class GitSyncInitMixin extends GitSyncInternalBase {
  async init(): Promise<void> {
    return this._withGitLock(async () => {
      try {
        const vaultPath = await this.getVaultPath()
        logger.info(`[GitSync] 正在初始化 Git 仓库: ${vaultPath}`)
        const git = await this.ensureGit()
        await git.init()
        await this.ensureGitignore()
        await this.loadConfig()

        if (this.config.userName) {
          await git.addConfig('user.name', this.config.userName)
        }
        if (this.config.userEmail) {
          await git.addConfig('user.email', this.config.userEmail)
        }

        await git.add('.gitignore')
        try {
          await git.commit('初始化 Git 版本管理')
        } catch (commitErr) {
          logger.warn(`[GitSync] 初始提交失败 (可能是未配置 user.name/email):`, commitErr as any)
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

        logger.info(`[GitSync] Git 仓库初始化成功: ${vaultPath}`)
      } catch (error) {
        logger.error(`[GitSync] Git 仓库初始化失败: ${error}`)
        throw new GitInitError(error instanceof Error ? error : undefined)
      }
    })
  }

  async isInitialized(): Promise<boolean> {
    try {
      const vaultPath = await this.getVaultPath()
      return fs.existsSync(path.join(vaultPath, '.git'))
    } catch {
      return false
    }
  }
}
