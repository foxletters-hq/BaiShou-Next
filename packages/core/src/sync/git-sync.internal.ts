import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import simpleGit, { SimpleGit } from 'simple-git'
import { logger } from '@baishou/shared'
import type { GitSyncConfig } from '@baishou/shared'
import { GitInitError } from './sync.errors'
import type { IStoragePathService } from '../vault/storage-path.types'
import {
  DEFAULT_GIT_SYNC_CONFIG,
  GIT_INDEX_MAINTENANCE_MAX_ROUNDS,
  GIT_RAW_COMMAND_TIMEOUT_MS,
  GITIGNORE_CONTENT,
  GIT_SYNC_CONFIG_FILE,
  STAGE_ADD_CHUNK_SIZE,
  STAGE_FAST_ADD_THRESHOLD,
  STAGE_MAX_ARG_CHARS
} from './git-sync.constants'
import {
  getAuthenticatedUrl,
  isBaishouManagedPath,
  isExcludedFromVersionControl,
  mapWorkingStatus,
  parseGitlinkPathFromLsFilesLine,
  unquoteGitPath
} from './git-sync.helpers'
import {
  applyGitProcessEnv,
  getBundledGitBinary,
  getBundledGitSpawnEnv
} from './git-binary.registry'

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
    applyGitProcessEnv()
    const gitRoot = await this.getGitRoot()
    if (!this.git || this.currentGitRoot !== gitRoot) {
      this.git = simpleGit({
        baseDir: gitRoot,
        binary: getBundledGitBinary()
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
        if (!content.includes('*.conflict-')) {
          content += '\n# 增量同步冲突备份\n**/*.conflict-*\n'
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

  protected splitGitLsFilesOutput(output: string): string[] {
    const separator = output.includes('\0') ? '\0' : '\n'
    return output
      .split(separator)
      .map((line) => unquoteGitPath(line.trim()))
      .filter(Boolean)
  }

  protected async runGitWithStdin(_git: SimpleGit, args: string[], stdin?: Buffer): Promise<string> {
    const gitRoot = await this.getGitRoot()
    const { env, gitBinary } = getBundledGitSpawnEnv({ LC_ALL: 'C.UTF-8' })
    return new Promise((resolve, reject) => {
      const proc = spawn(gitBinary, args, {
        cwd: gitRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      })
      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        proc.kill()
        reject(new Error(`git ${args.join(' ')} timed out`))
      }, GIT_RAW_COMMAND_TIMEOUT_MS)

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn()
      }

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      proc.on('error', (err) => finish(() => reject(err)))
      proc.on('close', (code) => {
        finish(() => {
          if (code === 0) resolve(stdout)
          else reject(new Error(stderr.trim() || `git ${args.join(' ')} failed (${code})`))
        })
      })
      if (stdin) {
        proc.stdin.write(stdin)
      }
      proc.stdin.end()
    })
  }

  protected async forceRemoveFromGitIndexWithStdin(
    git: SimpleGit,
    filePath: string
  ): Promise<boolean> {
    try {
      await this.runGitWithStdin(
        git,
        ['update-index', '--force-remove', '-z', '--stdin'],
        Buffer.from(`${filePath}\0`, 'utf8')
      )
      return true
    } catch {
      return false
    }
  }

  /** 从索引移除路径；Windows 下中文等非 ASCII 路径优先走 stdin 避免 pathspec 匹配失败 */
  protected async forceRemoveFromGitIndex(git: SimpleGit, filePath: string): Promise<boolean> {
    const hasNonAscii = /[^\u0000-\u007f]/.test(filePath)

    if (hasNonAscii) {
      if (await this.forceRemoveFromGitIndexWithStdin(git, filePath)) {
        return true
      }
      logger.warn(`[GitSync] 无法移出追踪: ${filePath}`)
      return false
    }

    try {
      await git.rm(['-f', '--cached', '--', filePath])
      return true
    } catch {
      if (await this.forceRemoveFromGitIndexWithStdin(git, filePath)) {
        return true
      }
      logger.warn(`[GitSync] 无法移出追踪: ${filePath}`)
      return false
    }
  }

  /** 修复 gitlink / 清理索引；有界循环，避免递归 getStatus */
  protected async maintainGitIndex(git: SimpleGit): Promise<void> {
    for (let round = 0; round < GIT_INDEX_MAINTENANCE_MAX_ROUNDS; round++) {
      const repaired = await this.repairVaultGitlinks(git)
      const sanitized = await this.sanitizeGitIndex(git)
      if (!repaired && !sanitized) {
        break
      }
    }
  }

  protected vaultDirectoryExists(gitRoot: string, vaultName: string): boolean {
    try {
      const vaultPath = path.join(gitRoot, vaultName)
      return fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory()
    } catch {
      return false
    }
  }

  protected async listIndexedBaishouPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['ls-files', '-z'])
    return this.splitGitLsFilesOutput(output).filter((line) => isBaishouManagedPath(line))
  }

  protected async sanitizeGitIndex(git: SimpleGit): Promise<boolean> {
    const gitRoot = await this.getGitRoot()
    const gitlinks = await this.listIndexedGitlinkPaths(git)
    const indexed = this.splitGitLsFilesOutput(await git.raw(['ls-files', '-z']))

    const toRemove = new Set<string>()
    for (const gitlinkPath of gitlinks) {
      if (!this.vaultDirectoryExists(gitRoot, gitlinkPath)) {
        toRemove.add(gitlinkPath)
      }
    }
    for (const filePath of indexed) {
      if (this.isExcludedFromVersionControl(filePath)) {
        toRemove.add(filePath)
      }
    }

    if (toRemove.size === 0) return false

    logger.info(`[GitSync] 从索引移除 ${toRemove.size} 个不应版本化的路径（含 gitlink/归档/配置）`)

    let anyRemoved = false
    for (const filePath of toRemove) {
      if (await this.forceRemoveFromGitIndex(git, filePath)) {
        anyRemoved = true
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

  protected async addPathsToIndex(git: SimpleGit, paths: string[]): Promise<number> {
    if (paths.length === 0) return 0

    if (paths.length >= STAGE_FAST_ADD_THRESHOLD) {
      try {
        await git.add('.')
        return paths.length
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn(`[GitSync] 批量 git add . 失败，改为分块暂存: ${msg}`)
      }
    }

    let staged = 0
    let chunk: string[] = []
    let chunkChars = 0

    const flushChunk = async (): Promise<void> => {
      if (chunk.length === 0) return
      const current = chunk
      chunk = []
      chunkChars = 0
      try {
        if (current.length === 1) {
          await git.add(current[0])
        } else {
          await git.add(['--', ...current])
        }
        staged += current.length
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn(`[GitSync] 分块暂存失败，改为逐文件: ${msg}`)
        for (const filePath of current) {
          try {
            await git.add(filePath)
            staged++
          } catch (fileErr: unknown) {
            const fileMsg = fileErr instanceof Error ? fileErr.message : String(fileErr)
            logger.warn(`[GitSync] 跳过无法暂存的文件: ${filePath} (${fileMsg})`)
          }
        }
      }
    }

    for (const filePath of paths) {
      const entryChars = filePath.length + 3
      if (
        chunk.length > 0 &&
        (chunk.length >= STAGE_ADD_CHUNK_SIZE || chunkChars + entryChars > STAGE_MAX_ARG_CHARS)
      ) {
        await flushChunk()
      }
      chunk.push(filePath)
      chunkChars += entryChars
    }
    await flushChunk()

    return staged
  }

  protected async stagePendingChanges(git: SimpleGit): Promise<number> {
    await this.ensureGitignore()
    await this.maintainGitIndex(git)

    const paths = await this.collectUnstagedPaths(git)
    if (paths.length === 0) {
      logger.info('[GitSync] 没有可暂存的变更（Changes 区域为空或均为系统文件）')
      return 0
    }

    logger.info(`[GitSync] 暂存 Changes 中的 ${paths.length} 个文件`)
    const staged = await this.addPathsToIndex(git, paths)
    await this.sanitizeGitIndex(git)
    return staged
  }

  protected filterVersionedPaths(paths: string[]): string[] {
    return paths.filter((p) => !this.isExcludedFromVersionControl(p))
  }

  protected async filterCommittableCachedPaths(git: SimpleGit): Promise<string[]> {
    const gitlinks = new Set(await this.listIndexedGitlinkPaths(git))
    return this.filterVersionedPaths(await this.getCachedPaths(git)).filter((p) => !gitlinks.has(p))
  }

  protected async listIndexedGitlinkPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['ls-files', '-s', '-z'])
    const paths = new Set<string>()
    for (const entry of output.split('\0')) {
      const gitlinkPath = parseGitlinkPathFromLsFilesLine(entry)
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
          if (await this.forceRemoveFromGitIndex(git, vaultName)) {
            repaired = true
          }
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
