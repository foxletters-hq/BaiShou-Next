import type { SyncManifest } from '../types/version-control.types'
import {
  collectVaultRenameProtectedPaths,
  detectVaultRenameCandidates,
  executeVaultRenamePass,
  simulateVaultRenamePass,
  type VaultRenameCandidate,
  type VaultRenameCloudClient,
  type VaultRenamePassResult
} from './sync-vault-rename-pass.util'

export type PreparedVaultRenamePass = {
  /** 是否已把远端/祖先迁到新前缀（执行成功或规划模拟） */
  applied: boolean
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  renamedFileCount: number
  renames: VaultRenameCandidate[]
  /** 失败回落或仅检测时，旧前缀路径仍应排除 mass_delete */
  protectedDeleteRemotePaths: Set<string>
  executeResult?: VaultRenamePassResult
}

/**
 * 规划阶段：内存模拟 rename pass，使 preview 接近执行成功后的空/少变更计划。
 */
export function prepareVaultRenamePassForPlan(options: {
  localVaults: Record<string, string>
  lastRemoteVaults: Record<string, string>
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
}): PreparedVaultRenamePass {
  const simulated = simulateVaultRenamePass(options)
  const protectedDeleteRemotePaths = collectVaultRenameProtectedPaths(simulated.renames)
  return {
    applied: simulated.applied,
    remoteManifest: simulated.remoteManifest,
    ancestorSnapshot: simulated.ancestorSnapshot,
    renamedFileCount: simulated.renamedFileCount,
    renames: simulated.renames,
    protectedDeleteRemotePaths
  }
}

/**
 * 执行阶段：尝试云端 rename；失败则回落（返回未迁移的原始 manifest + 保护路径）。
 */
export async function prepareVaultRenamePassForSync(options: {
  localVaults: Record<string, string>
  lastRemoteVaults: Record<string, string>
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  cloudClient?: VaultRenameCloudClient | null
  preferDirectoryMove?: boolean
}): Promise<PreparedVaultRenamePass> {
  const candidates = detectVaultRenameCandidates(
    options.localVaults,
    options.lastRemoteVaults,
    options.remoteManifest
  )
  const protectedDeleteRemotePaths = collectVaultRenameProtectedPaths(candidates)

  if (candidates.length === 0) {
    return {
      applied: false,
      remoteManifest: options.remoteManifest,
      ancestorSnapshot: options.ancestorSnapshot,
      renamedFileCount: 0,
      renames: [],
      protectedDeleteRemotePaths
    }
  }

  const executeResult = await executeVaultRenamePass(options)
  if (!executeResult.ok) {
    console.warn(
      `[VaultRenamePass] abandoned (${executeResult.reason}); falling back to naive delete+upload`,
      executeResult.error instanceof Error ? executeResult.error.message : executeResult.error
    )
    return {
      applied: false,
      remoteManifest: options.remoteManifest,
      ancestorSnapshot: options.ancestorSnapshot,
      renamedFileCount: 0,
      renames: executeResult.renames,
      protectedDeleteRemotePaths,
      executeResult
    }
  }

  return {
    applied: true,
    remoteManifest: executeResult.remoteManifest,
    ancestorSnapshot: executeResult.ancestorSnapshot,
    renamedFileCount: executeResult.renamedFileCount,
    renames: executeResult.renames,
    protectedDeleteRemotePaths: new Set(),
    executeResult
  }
}
