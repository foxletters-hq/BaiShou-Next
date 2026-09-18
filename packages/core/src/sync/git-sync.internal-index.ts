import i18n from 'i18next'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import type { SimpleGit } from 'simple-git'
import { logger } from '@baishou/shared'
import { GITIGNORE_CONTENT, GIT_RAW_COMMAND_TIMEOUT_MS } from './git-sync.constants'
import {
  isBaishouManagedPath,
  isStorageWriteProbePath,
  parseGitlinkPathFromLsFilesLine,
  unquoteGitPath
} from './git-sync.helpers'
import {
  cleanupStorageWriteProbeFiles,
  unlinkStorageWriteProbeIfPresent
} from './storage-write-probe.cleanup'
import { getBundledGitSpawnEnv } from './git-binary.registry'
import { GitSyncInternalConfigBase } from './git-sync.internal-base'

export abstract class GitSyncInternalIndexMixin extends GitSyncInternalConfigBase {
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
          content += i18n.t(
            'auto.packages.core.src.sync.git.sync.internal.L226',
            '\n# 忽略应用数据目录\n**/.baishou/\n.baishou/\n'
          )
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
          content += i18n.t(
            'auto.packages.core.src.sync.git.sync.internal.L242',
            '\n# 工作区嵌套 Git 归档\n**/.git.vault-legacy/\n'
          )
          modified = true
        }
        if (!content.includes('*.conflict-')) {
          content += i18n.t(
            'auto.packages.core.src.sync.git.sync.internal.L246',
            '\n# 增量同步冲突备份\n**/*.conflict-*\n'
          )
          modified = true
        }
        if (!content.includes('.write_test')) {
          content += i18n.t(
            'auto.packages.core.src.sync.git.sync.internal.L251',
            '\n# 存储路径可写性探测（勿入库）\n.write_test\n.write_test_*\n.baishou_write_test\n'
          )
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

    const removed = await cleanupStorageWriteProbeFiles(gitRoot, 1)
    if (removed > 0) {
      logger.info(`[GitSync] 已清理 ${removed} 个历史存储探测临时文件`)
    }
  }

  protected async untrackBaishouDir(): Promise<void> {
    const git = await this.ensureGit()
    await this.sanitizeGitIndex(git)
  }

  protected splitGitLsFilesOutput(output: string): string[] {
    const separator = output.includes('\0') ? '\0' : '\n'
    return output
      .split(separator)
      .map((line) => unquoteGitPath(line.trim()))
      .filter(Boolean)
  }

  protected async runGitWithStdin(
    _git: SimpleGit,
    args: string[],
    stdin?: Buffer
  ): Promise<string> {
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

  protected async listIndexedGitlinkPaths(git: SimpleGit): Promise<string[]> {
    const output = await git.raw(['ls-files', '-s', '-z'])
    const paths = new Set<string>()
    for (const entry of output.split('\0')) {
      const gitlinkPath = parseGitlinkPathFromLsFilesLine(entry)
      if (gitlinkPath) paths.add(gitlinkPath)
    }
    return [...paths]
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
        if (isStorageWriteProbePath(filePath)) {
          await unlinkStorageWriteProbeIfPresent(gitRoot, filePath)
        }
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
}
