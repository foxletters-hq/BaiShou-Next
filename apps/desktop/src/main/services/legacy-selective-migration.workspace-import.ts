import { join } from 'node:path'
import { discoverVaultNames, mergeDirectoriesSkipExisting } from '@baishou/core/shared'
import type { LegacyMigrationImportSectionResult } from '@baishou/shared'
import { DesktopStoragePathService } from './path.service'
import { vaultService } from '../ipc/vault.ipc'
import { emptySectionResult, type ProgressFn } from './legacy-selective-migration.helpers'
export interface LegacyMigrationImportCtx {
  fileSystem: import('@baishou/core-desktop').NodeFileSystem
  wasCancelled: () => boolean
}

const WORKSPACE_COPY_SUBDIRS = ['attachments', 'Archives'] as const

export async function importWorkspaces(
  ctx: LegacyMigrationImportCtx,
  sourceDir: string,
  onProgress?: ProgressFn
): Promise<LegacyMigrationImportSectionResult> {
  const result = emptySectionResult('workspaces')
  const vaultNames = await discoverVaultNames(ctx.fileSystem, sourceDir)
  const targetRoot = await new DesktopStoragePathService().getRootDirectory()

  for (const vaultName of vaultNames) {
    if (ctx.wasCancelled()) break
    onProgress?.({
      phase: 'import',
      section: 'workspaces',
      message: `正在登记工作空间 ${vaultName}`
    })
    try {
      if (!vaultService.vaultExists(vaultName)) {
        await vaultService.createVault(vaultName)
      }
      const srcVault = join(sourceDir, vaultName)
      const destVault = join(targetRoot, vaultName)
      const copyFailures: string[] = []
      for (const sub of WORKSPACE_COPY_SUBDIRS) {
        const src = join(srcVault, sub)
        const dest = join(destVault, sub)
        if (await ctx.fileSystem.exists(src)) {
          const failed = await mergeDirectoriesSkipExisting(ctx.fileSystem, src, dest)
          copyFailures.push(...failed)
        }
      }
      if (copyFailures.length > 0) {
        result.failed += 1
        result.errors.push(
          `${vaultName}: ${copyFailures.length} 个文件复制失败（示例: ${copyFailures.slice(0, 2).join(', ')})`
        )
      } else {
        result.success += 1
      }
    } catch (e) {
      result.failed += 1
      result.errors.push(`${vaultName}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return result
}
