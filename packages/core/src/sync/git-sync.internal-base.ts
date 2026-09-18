import * as fs from 'fs'
import * as path from 'path'
import simpleGit, { SimpleGit } from 'simple-git'
import type { GitSyncConfig } from '@baishou/shared'
import { GitInitError } from './sync.errors'
import type { IStoragePathService } from '../vault/storage-path.types'
import {
  DEFAULT_GIT_AUTHOR_EMAIL,
  DEFAULT_GIT_AUTHOR_NAME,
  DEFAULT_GIT_SYNC_CONFIG,
  GIT_SYNC_CONFIG_FILE
} from './git-sync.constants'
import { getAuthenticatedUrl, isExcludedFromVersionControl } from './git-sync.helpers'
import { applyGitProcessEnv, getBundledGitBinary } from './git-binary.registry'

export abstract class GitSyncInternalConfigBase {
  protected git: SimpleGit | null = null
  protected config: GitSyncConfig = { ...DEFAULT_GIT_SYNC_CONFIG }
  protected readonly configFileName = GIT_SYNC_CONFIG_FILE
  protected currentGitRoot: string | null = null

  private _gitBusy = false
  private _gitQueue: Array<() => void> = []

  constructor(protected readonly pathService: IStoragePathService) {}

  protected _acquireGitLock(): Promise<void> {
    if (!this._gitBusy) {
      this._gitBusy = true
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this._gitQueue.push(resolve)
    })
  }

  protected _releaseGitLock(): void {
    if (this._gitQueue.length > 0) {
      const next = this._gitQueue.shift()!
      next()
    } else {
      this._gitBusy = false
    }
  }

  protected async _withGitLock<T>(fn: () => Promise<T>): Promise<T> {
    await this._acquireGitLock()
    try {
      return await fn()
    } finally {
      this._releaseGitLock()
    }
  }

  /** Git 仓库根：存储根目录（管理全部工作区） */
  protected async getGitRoot(): Promise<string> {
    const root = await this.pathService.getRootDirectory()
    if (!root) {
      throw new GitInitError(new Error('未找到存储根目录'))
    }
    return root
  }

  protected async ensureRootConfigPath(): Promise<string> {
    const root = await this.getGitRoot()
    const rootConfig = path.join(root, this.configFileName)
    if (fs.existsSync(rootConfig)) {
      return rootConfig
    }

    const vaultPath = await this.pathService.getActiveVaultPath()
    if (vaultPath) {
      const legacyConfig = path.join(vaultPath, this.configFileName)
      if (fs.existsSync(legacyConfig)) {
        const raw = await fs.promises.readFile(legacyConfig, 'utf8')
        await fs.promises.writeFile(rootConfig, raw)
        await fs.promises.unlink(legacyConfig).catch(() => {})
      }
    }

    return rootConfig
  }

  protected async ensureGit(): Promise<SimpleGit> {
    applyGitProcessEnv()
    const gitRoot = await this.getGitRoot()
    if (!this.git || this.currentGitRoot !== gitRoot) {
      this.git = simpleGit({
        baseDir: gitRoot,
        binary: getBundledGitBinary(),
        config: ['core.quotepath=false']
      })
      this.currentGitRoot = gitRoot
    }
    return this.git
  }

  protected async loadConfig(): Promise<void> {
    const configPath = await this.ensureRootConfigPath()

    if (fs.existsSync(configPath)) {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8')
        const saved = JSON.parse(raw) as Partial<GitSyncConfig>
        this.config = { ...DEFAULT_GIT_SYNC_CONFIG, ...saved }
      } catch {
        this.config = { ...DEFAULT_GIT_SYNC_CONFIG }
      }
    }
  }

  protected async saveConfig(): Promise<void> {
    const configPath = await this.ensureRootConfigPath()
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  protected async readGitConfigValue(
    git: SimpleGit,
    key: string,
    scope?: 'local' | 'global'
  ): Promise<string | undefined> {
    try {
      const args = ['config', '--get']
      if (scope === 'global') args.push('--global')
      args.push(key)
      const result = await git.raw(args)
      const trimmed = result?.trim()
      return trimmed || undefined
    } catch {
      return undefined
    }
  }

  /** 提交前确保本地仓库已配置 user.name / user.email */
  protected async ensureAuthorIdentity(git: SimpleGit): Promise<void> {
    await this.loadConfig()

    let name = this.config.userName?.trim()
    let email = this.config.userEmail?.trim()

    if (!name) {
      name = await this.readGitConfigValue(git, 'user.name')
    }
    if (!email) {
      email = await this.readGitConfigValue(git, 'user.email')
    }
    if (!name) {
      name = await this.readGitConfigValue(git, 'user.name', 'global')
    }
    if (!email) {
      email = await this.readGitConfigValue(git, 'user.email', 'global')
    }
    if (!name) {
      name = DEFAULT_GIT_AUTHOR_NAME
    }
    if (!email) {
      email = DEFAULT_GIT_AUTHOR_EMAIL
    }

    const currentName = await this.readGitConfigValue(git, 'user.name')
    const currentEmail = await this.readGitConfigValue(git, 'user.email')
    if (currentName !== name) {
      await git.addConfig('user.name', name)
    }
    if (currentEmail !== email) {
      await git.addConfig('user.email', email)
    }

    let configChanged = false
    if (!this.config.userName?.trim()) {
      this.config.userName = name
      configChanged = true
    }
    if (!this.config.userEmail?.trim()) {
      this.config.userEmail = email
      configChanged = true
    }
    if (configChanged) {
      await this.saveConfig()
    }
  }

  protected getAuthenticatedUrl(url: string, username?: string, token?: string): string {
    return getAuthenticatedUrl(url, username, token)
  }

  protected isExcludedFromVersionControl(filePath: string): boolean {
    return isExcludedFromVersionControl(filePath)
  }

  protected async getCachedPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['diff', '--cached', '--name-only'])
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
}
