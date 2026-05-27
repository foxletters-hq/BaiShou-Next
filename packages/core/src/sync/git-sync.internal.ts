import * as fs from 'fs'
import * as path from 'path'
import simpleGit, { SimpleGit } from 'simple-git'
import { logger } from '@baishou/shared'
import type { GitSyncConfig } from '@baishou/shared'
import { GitInitError } from './sync.errors'
import type { IStoragePathService } from '../vault/storage-path.types'
import {
  DEFAULT_GIT_SYNC_CONFIG,
  GITIGNORE_CONTENT,
  GIT_SYNC_CONFIG_FILE
} from './git-sync.constants'
import { getAuthenticatedUrl, isExcludedFromVersionControl } from './git-sync.helpers'

export abstract class GitSyncInternalBase {
  protected git: SimpleGit | null = null
  protected config: GitSyncConfig = { ...DEFAULT_GIT_SYNC_CONFIG }
  protected readonly configFileName = GIT_SYNC_CONFIG_FILE
  protected currentVaultPath: string | null = null

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

  protected async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new GitInitError(new Error('No active vault found'))
    }
    return vaultPath
  }

  protected async ensureGit(): Promise<SimpleGit> {
    const vaultPath = await this.getVaultPath()
    if (!this.git || this.currentVaultPath !== vaultPath) {
      this.git = simpleGit(vaultPath)
      this.currentVaultPath = vaultPath
    }
    return this.git
  }

  protected async loadConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, this.configFileName)

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
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, this.configFileName)
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  protected async ensureGitignore(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const gitignorePath = path.join(vaultPath, '.gitignore')

    if (!fs.existsSync(gitignorePath)) {
      await fs.promises.writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf8')
    } else {
      try {
        let content = await fs.promises.readFile(gitignorePath, 'utf8')
        let modified = false
        if (!content.includes('.baishou/')) {
          content += '\n# 忽略数据文件夹\n.baishou/\n'
          modified = true
        }
        if (!content.includes('*.db-shm')) {
          content += '\n*.db-shm\n'
          modified = true
        }
        if (modified) {
          await fs.promises.writeFile(gitignorePath, content, 'utf8')
        }
      } catch {}
    }

    await this.untrackBaishouDir()
  }

  protected async untrackBaishouDir(): Promise<void> {
    const git = await this.ensureGit()
    await this.untrackBaishouFiles(git)
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

  protected async listIndexedBaishouPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['ls-files', '--', '.baishou'])
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  protected async untrackBaishouFiles(git: SimpleGit): Promise<boolean> {
    const tracked = await this.listIndexedBaishouPaths(git)
    if (tracked.length === 0) return false

    logger.info(
      `[GitSync] 发现有 ${tracked.length} 个 .baishou 内部文件被错误追踪，正在强制移除追踪...`
    )

    let anyRemoved = false
    for (const filePath of tracked) {
      try {
        await git.rm(['-f', '--cached', '--', filePath])
        anyRemoved = true
      } catch (err) {
        logger.warn(`[GitSync] 无法移出追踪: ${filePath}`, err as any)
      }
    }
    return anyRemoved
  }

  protected async collectUnstagedPaths(git: SimpleGit): Promise<string[]> {
    const status = await git.status()
    const paths = new Set<string>()

    for (const p of status.modified) {
      if (!this.isExcludedFromVersionControl(p)) paths.add(p)
    }
    for (const p of status.deleted) {
      if (!this.isExcludedFromVersionControl(p)) paths.add(p)
    }
    for (const p of status.not_added) {
      if (!this.isExcludedFromVersionControl(p)) paths.add(p)
    }
    for (const p of status.created) {
      if (!this.isExcludedFromVersionControl(p)) paths.add(p)
    }
    for (const item of status.renamed) {
      const p = typeof item === 'string' ? item : item.to || item.from
      if (p && !this.isExcludedFromVersionControl(p)) paths.add(p)
    }

    return [...paths]
  }

  protected async stagePendingChanges(git: SimpleGit): Promise<number> {
    await this.ensureGitignore()
    await this.untrackBaishouFiles(git)

    const paths = await this.collectUnstagedPaths(git)
    if (paths.length === 0) {
      logger.info('[GitSync] 没有可暂存的变更（Changes 区域为空或均为系统文件）')
      return 0
    }

    logger.info(`[GitSync] 暂存 Changes 中的 ${paths.length} 个文件`)
    await git.add(paths)
    return paths.length
  }

  protected filterVersionedPaths(paths: string[]): string[] {
    return paths.filter((p) => !this.isExcludedFromVersionControl(p))
  }
}
