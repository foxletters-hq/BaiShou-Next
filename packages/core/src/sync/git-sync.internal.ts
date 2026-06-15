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
import {
  getAuthenticatedUrl,
  isBaishouManagedPath,
  isExcludedFromVersionControl,
  mapWorkingStatus,
  parseGitlinkPathFromLsFilesLine
} from './git-sync.helpers'

const VAULT_REPAIR_SKIP_DIRS = new Set([
  '.git',
  '.baishou',
  'snapshots',
  'temp',
  '.snapshots',
  'node_modules'
])

export abstract class GitSyncInternalBase {
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
      throw new GitInitError(new Error('No storage root found'))
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
    const gitRoot = await this.getGitRoot()
    if (!this.git || this.currentGitRoot !== gitRoot) {
      this.git = simpleGit(gitRoot)
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

  protected async ensureGitignore(): Promise<void> {
    const gitRoot = await this.getGitRoot()
    const gitignorePath = path.join(gitRoot, '.gitignore')

    if (!fs.existsSync(gitignorePath)) {
      await fs.promises.writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf8')
    } else {
      try {
        let content = await fs.promises.readFile(gitignorePath, 'utf8')
        let modified = false
        if (!content.includes('.baishou/')) {
          content += '\n# 忽略应用数据目录\n**/.baishou/\n.baishou/\n'
          modified = true
        }
        if (!content.includes('.baishou-s3.json')) {
          content += '\n.baishou-s3.json\n'
          modified = true
        }
        if (!content.includes('*.db-shm')) {
          content += '\n*.db-shm\n'
          modified = true
        }
        if (!content.includes('.baishou-git.json')) {
          content += '\n.baishou-git.json\n'
          modified = true
        }
        if (!content.includes('.git.vault-legacy')) {
          content += '\n# 工作区嵌套 Git 归档\n**/.git.vault-legacy/\n'
          modified = true
        }
        if (modified) {
          await fs.promises.writeFile(gitignorePath, content, 'utf8')
        }
      } catch {
        // ignore
      }
    }

    await this.untrackBaishouDir()
  }

  protected async untrackBaishouDir(): Promise<void> {
    const git = await this.ensureGit()
    await this.sanitizeGitIndex(git)
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
    const output = await git.raw(['ls-files'])
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && isBaishouManagedPath(line))
  }

  protected async sanitizeGitIndex(git: SimpleGit): Promise<boolean> {
    const gitlinks = await this.listIndexedGitlinkPaths(git)
    const indexed = (await git.raw(['ls-files']))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const toRemove = new Set<string>(gitlinks)
    for (const filePath of indexed) {
      if (this.isExcludedFromVersionControl(filePath)) {
        toRemove.add(filePath)
      }
    }

    if (toRemove.size === 0) return false

    logger.info(
      `[GitSync] 从索引移除 ${toRemove.size} 个不应版本化的路径（含 gitlink/归档/配置）`
    )

    let anyRemoved = false
    for (const filePath of toRemove) {
      try {
        await git.rm(['-f', '--cached', '--', filePath])
        anyRemoved = true
      } catch (err) {
        logger.warn(`[GitSync] 无法移出追踪: ${filePath}`, err as any)
      }
    }
    return anyRemoved
  }

  /** @deprecated 使用 sanitizeGitIndex */
  protected async untrackBaishouFiles(git: SimpleGit): Promise<boolean> {
    return this.sanitizeGitIndex(git)
  }

  protected async collectUnstagedPaths(git: SimpleGit): Promise<string[]> {
    const status = await git.status()
    const paths = new Set<string>()

    for (const file of status.files) {
      if (this.isExcludedFromVersionControl(file.path)) continue
      if (file.index === '?' || file.working_dir === '?') continue
      if (mapWorkingStatus(file.working_dir) !== '') {
        paths.add(file.path)
      }
    }
    for (const p of status.not_added) {
      if (!this.isExcludedFromVersionControl(p)) paths.add(p)
    }

    return [...paths]
  }

  protected async stagePendingChanges(git: SimpleGit): Promise<number> {
    await this.ensureGitignore()
    await this.sanitizeGitIndex(git)
    await this.repairVaultGitlinks(git)
    await this.sanitizeGitIndex(git)

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

  protected async filterCommittableCachedPaths(git: SimpleGit): Promise<string[]> {
    const gitlinks = new Set(await this.listIndexedGitlinkPaths(git))
    return this.filterVersionedPaths(await this.getCachedPaths(git)).filter((p) => !gitlinks.has(p))
  }

  protected async listIndexedGitlinkPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['ls-files', '-s'])
    const paths = new Set<string>()
    for (const line of output.split('\n')) {
      const gitlinkPath = parseGitlinkPathFromLsFilesLine(line)
      if (gitlinkPath) paths.add(gitlinkPath)
    }
    return [...paths]
  }

  protected async listVaultNestedGitDirs(gitRoot: string): Promise<string[]> {
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(gitRoot, { withFileTypes: true })
    } catch {
      return []
    }

    const vaultNames: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || VAULT_REPAIR_SKIP_DIRS.has(entry.name)) continue
      const nestedGit = path.join(gitRoot, entry.name, '.git')
      if (fs.existsSync(nestedGit)) {
        vaultNames.push(entry.name)
      }
    }
    return vaultNames
  }

  protected async archiveNestedVaultGit(vaultPath: string): Promise<void> {
    const nestedGit = path.join(vaultPath, '.git')
    if (!fs.existsSync(nestedGit)) return

    const backup = path.join(vaultPath, '.git.vault-legacy')
    if (fs.existsSync(backup)) {
      await fs.promises.rm(backup, { recursive: true, force: true })
    }
    await fs.promises.rename(nestedGit, backup)
    logger.info(`[GitSync] 已归档工作区嵌套 .git: ${nestedGit} -> ${backup}`)
  }

  /**
   * 将误当作 gitlink/子模块的工作区目录恢复为普通文件跟踪，
   * 以便状态列表展示 Vault 内具体文件路径并可正常暂存/提交。
   */
  protected async repairVaultGitlinks(git: SimpleGit): Promise<boolean> {
    const gitRoot = await this.getGitRoot()
    const gitlinkPaths = await this.listIndexedGitlinkPaths(git)
    const nestedGitVaults = await this.listVaultNestedGitDirs(gitRoot)
    const vaultsToRepair = new Set([...gitlinkPaths, ...nestedGitVaults])
    if (vaultsToRepair.size === 0) return false

    logger.info(
      `[GitSync] 发现 ${vaultsToRepair.size} 个工作区被当作子模块/gitlink，正在修复为普通文件跟踪...`
    )

    let repaired = false
    for (const vaultName of vaultsToRepair) {
      try {
        if (gitlinkPaths.includes(vaultName)) {
          try {
            await git.reset(['HEAD', '--', vaultName])
          } catch {
            // 可能尚未暂存
          }
          await git.rm(['-f', '--cached', '--', vaultName])
          repaired = true
        }

        const vaultPath = path.join(gitRoot, vaultName)
        if (fs.existsSync(vaultPath)) {
          const hadNestedGit = fs.existsSync(path.join(vaultPath, '.git'))
          if (hadNestedGit) {
            await this.archiveNestedVaultGit(vaultPath)
            repaired = true
          }
        }
      } catch (err) {
        logger.warn(`[GitSync] 修复工作区 ${vaultName} 失败:`, err as any)
      }
    }

    return repaired
  }

  protected async getCommittedFileNames(git: SimpleGit, commitHash: string): Promise<string[]> {
    const output = await git.raw(['diff-tree', '--no-commit-id', '--name-only', '-r', commitHash])
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !this.isExcludedFromVersionControl(line))
  }
}
