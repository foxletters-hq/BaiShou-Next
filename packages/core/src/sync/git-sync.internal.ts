import * as fs from 'fs'
import * as path from 'path'
import type { SimpleGit } from 'simple-git'
import { logger } from '@baishou/shared'
import {
  STAGE_ADD_CHUNK_SIZE,
  STAGE_FAST_ADD_THRESHOLD,
  STAGE_MAX_ARG_CHARS
} from './git-sync.constants'
import { mapWorkingStatus } from './git-sync.helpers'
import { GitSyncInternalRepairMixin } from './git-sync.internal-repair'

export abstract class GitSyncInternalBase extends GitSyncInternalRepairMixin {
  protected async collectUnstagedPaths(git: SimpleGit): Promise<string[]> {
    const status = await git.status()
    const gitRoot = await this.getGitRoot()
    const paths = new Set<string>()

    for (const file of status.files) {
      if (this.isExcludedFromVersionControl(file.path)) continue
      if (file.index === '?' || file.working_dir === '?') continue
      if (mapWorkingStatus(file.working_dir) !== '') {
        paths.add(file.path)
      }
    }
    for (const p of status.not_added) {
      if (this.isExcludedFromVersionControl(p)) continue
      try {
        if (!fs.existsSync(path.join(gitRoot, p))) continue
      } catch {
        continue
      }
      paths.add(p)
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
          const file = current[0]
          if (file) await git.add(file)
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

  protected async getCommittedFileNames(git: SimpleGit, commitHash: string): Promise<string[]> {
    const output = await git.raw(['diff-tree', '--no-commit-id', '--name-only', '-r', commitHash])
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !this.isExcludedFromVersionControl(line))
  }
}
