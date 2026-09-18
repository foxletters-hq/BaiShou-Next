import * as fs from 'fs'
import * as path from 'path'
import type { SimpleGit } from 'simple-git'
import { logger } from '@baishou/shared'
import { GIT_INDEX_MAINTENANCE_MAX_ROUNDS } from './git-sync.constants'
import { cleanupStorageWriteProbeFiles } from './storage-write-probe.cleanup'
import { GitSyncInternalIndexMixin } from './git-sync.internal-index'

const VAULT_REPAIR_SKIP_DIRS = new Set([
  '.git',
  '.baishou',
  'snapshots',
  'temp',
  '.snapshots',
  'node_modules'
])

export abstract class GitSyncInternalRepairMixin extends GitSyncInternalIndexMixin {
  /** 修复 gitlink / 清理索引；有界循环，避免递归 getStatus */
  protected async maintainGitIndex(git: SimpleGit): Promise<void> {
    const gitRoot = await this.getGitRoot()
    const removed = await cleanupStorageWriteProbeFiles(gitRoot, 1)
    if (removed > 0) {
      logger.info(`[GitSync] 已清理 ${removed} 个历史存储探测临时文件`)
    }

    for (let round = 0; round < GIT_INDEX_MAINTENANCE_MAX_ROUNDS; round++) {
      const repaired = await this.repairVaultGitlinks(git)
      const sanitized = await this.sanitizeGitIndex(git)
      if (!repaired && !sanitized) {
        break
      }
    }
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
}
