import type { SyncManifest } from '../types/version-control.types'
import {
  isSyncManifestPathUnderVault,
  migrateSyncManifestVaultPrefix,
  rewriteSyncManifestVaultPath
} from './migrate-sync-manifest-vault-prefix.util'

/** `.baishou/last-remote-vaults.json` 格式 */
export type LastRemoteVaultsSnapshot = {
  version: 1
  updatedAt: number
  /** vaultId → 目录名 / 显示名（同步路径首段） */
  vaults: Record<string, string>
}

export type VaultRenameCandidate = {
  vaultId: string
  oldName: string
  newName: string
  /** 远端 manifest 中旧前缀下的文件路径 */
  remoteFilePaths: string[]
}

export type VaultRenamePassSuccess = {
  ok: true
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  renamedFileCount: number
  renames: VaultRenameCandidate[]
}

export type VaultRenamePassFailure = {
  ok: false
  reason: 'no_candidates' | 'rename_unavailable' | 'rename_failed'
  error?: unknown
  /** 检测到的候选（失败时仍可供诊断 / 删除保护） */
  renames: VaultRenameCandidate[]
}

export type VaultRenamePassResult = VaultRenamePassSuccess | VaultRenamePassFailure

export type VaultRenameCloudClient = {
  renameFile(oldFilename: string, newFilename: string): Promise<void>
}

function normalizeName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
}

/** 列出 manifest 中属于某 vault 前缀的文件路径 */
export function listSyncManifestVaultFilePaths(
  manifest: SyncManifest,
  vaultName: string
): string[] {
  const name = normalizeName(vaultName)
  if (!name || !manifest.files) return []
  return Object.keys(manifest.files).filter((p) => isSyncManifestPathUnderVault(p, name))
}

/**
 * 从注册表 JSON（数组）解析 vaultId→name。
 * 无合法 id 的条目跳过。
 */
export function parseVaultIdToNameMap(registryJson: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(registryJson)) return out
  for (const item of registryJson) {
    if (!item || typeof item !== 'object') continue
    const id = typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id.trim() : ''
    const name =
      typeof (item as { name?: unknown }).name === 'string'
        ? normalizeName((item as { name: string }).name)
        : ''
    if (!id || !name) continue
    if (!id.startsWith('vlt_')) continue
    out[id] = name
  }
  return out
}

export function createEmptyLastRemoteVaultsSnapshot(
  updatedAt = Date.now()
): LastRemoteVaultsSnapshot {
  return { version: 1, updatedAt, vaults: {} }
}

export function parseLastRemoteVaultsSnapshot(raw: unknown): LastRemoteVaultsSnapshot {
  const empty = createEmptyLastRemoteVaultsSnapshot(0)
  if (!raw || typeof raw !== 'object') return empty
  const obj = raw as Record<string, unknown>
  const vaultsRaw = obj.vaults
  const vaults: Record<string, string> = {}
  if (vaultsRaw && typeof vaultsRaw === 'object' && !Array.isArray(vaultsRaw)) {
    for (const [id, name] of Object.entries(vaultsRaw as Record<string, unknown>)) {
      if (typeof id !== 'string' || !id.startsWith('vlt_')) continue
      if (typeof name !== 'string') continue
      const normalized = normalizeName(name)
      if (normalized) vaults[id] = normalized
    }
  }
  return {
    version: 1,
    updatedAt: typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0,
    vaults
  }
}

export function serializeLastRemoteVaultsSnapshot(
  vaults: Record<string, string>,
  updatedAt = Date.now()
): LastRemoteVaultsSnapshot {
  const normalized: Record<string, string> = {}
  for (const [id, name] of Object.entries(vaults)) {
    const n = normalizeName(name)
    if (!id.startsWith('vlt_') || !n) continue
    normalized[id] = n
  }
  return { version: 1, updatedAt, vaults: normalized }
}

/**
 * 检测需要服务端移动的改名：本机 id 目录名变了，且远端 manifest 仍有旧前缀。
 */
export function detectVaultRenameCandidates(
  localVaults: Record<string, string>,
  lastRemoteVaults: Record<string, string>,
  remoteManifest: SyncManifest
): VaultRenameCandidate[] {
  const candidates: VaultRenameCandidate[] = []
  for (const [vaultId, newNameRaw] of Object.entries(localVaults)) {
    const oldNameRaw = lastRemoteVaults[vaultId]
    if (!oldNameRaw) continue
    const oldName = normalizeName(oldNameRaw)
    const newName = normalizeName(newNameRaw)
    if (!oldName || !newName || oldName === newName) continue

    const remoteFilePaths = listSyncManifestVaultFilePaths(remoteManifest, oldName)
    if (remoteFilePaths.length === 0) continue

    // 远端若已有新前缀，说明其它设备已完成移动，本 pass 无需再搬
    const alreadyOnNew = listSyncManifestVaultFilePaths(remoteManifest, newName)
    if (alreadyOnNew.length > 0) continue

    candidates.push({ vaultId, oldName, newName, remoteFilePaths })
  }
  return candidates
}

/** rename 涉及的旧路径集合（删除保护应忽略这些 delete-remote） */
export function collectVaultRenameProtectedPaths(
  candidates: readonly VaultRenameCandidate[]
): Set<string> {
  const paths = new Set<string>()
  for (const c of candidates) {
    for (const p of c.remoteFilePaths) {
      paths.add(p.replace(/\\/g, '/'))
    }
  }
  return paths
}

/**
 * 将远端 manifest 与祖先快照的路径键一并迁到新前缀（rename pass 成功后的善后）。
 */
export function applyVaultRenamePassManifests(
  remoteManifest: SyncManifest,
  ancestorSnapshot: SyncManifest,
  renames: Array<{ oldName: string; newName: string }>
): {
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  migratedKeyCount: number
} {
  let remote = remoteManifest
  let ancestor = ancestorSnapshot
  let migratedKeyCount = 0
  for (const { oldName, newName } of renames) {
    const r = migrateSyncManifestVaultPrefix(remote, oldName, newName)
    const a = migrateSyncManifestVaultPrefix(ancestor, oldName, newName)
    remote = r.manifest
    ancestor = a.manifest
    migratedKeyCount += r.migratedKeyCount + a.migratedKeyCount
  }
  return { remoteManifest: remote, ancestorSnapshot: ancestor, migratedKeyCount }
}

/**
 * 仅内存模拟 rename pass 成功后的三方状态（用于 plan preview，不调云端）。
 */
export function simulateVaultRenamePass(options: {
  localVaults: Record<string, string>
  lastRemoteVaults: Record<string, string>
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
}): {
  applied: boolean
  renames: VaultRenameCandidate[]
  renamedFileCount: number
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
} {
  const renames = detectVaultRenameCandidates(
    options.localVaults,
    options.lastRemoteVaults,
    options.remoteManifest
  )
  if (renames.length === 0) {
    return {
      applied: false,
      renames,
      renamedFileCount: 0,
      remoteManifest: options.remoteManifest,
      ancestorSnapshot: options.ancestorSnapshot
    }
  }
  const renamedFileCount = renames.reduce((n, c) => n + c.remoteFilePaths.length, 0)
  const migrated = applyVaultRenamePassManifests(
    options.remoteManifest,
    options.ancestorSnapshot,
    renames
  )
  return {
    applied: true,
    renames,
    renamedFileCount,
    remoteManifest: migrated.remoteManifest,
    ancestorSnapshot: migrated.ancestorSnapshot
  }
}

function supportsRenameFile(client: VaultRenameCloudClient | null | undefined): boolean {
  return typeof client?.renameFile === 'function'
}

/**
 * 对单个 vault 执行云端路径移动。
 * WebDAV 可先尝试整目录 MOVE；失败再逐文件。
 * 任一文件失败即抛错（由调用方整体放弃）。
 */
async function renameVaultRemoteFiles(
  client: VaultRenameCloudClient,
  candidate: VaultRenameCandidate,
  preferDirectoryMove: boolean
): Promise<number> {
  if (preferDirectoryMove) {
    try {
      await client.renameFile(candidate.oldName, candidate.newName)
      return candidate.remoteFilePaths.length
    } catch {
      // 整目录 MOVE 不可用时回落逐文件
    }
  }

  let count = 0
  for (const oldPath of candidate.remoteFilePaths) {
    const newPath = rewriteSyncManifestVaultPath(oldPath, candidate.oldName, candidate.newName)
    if (newPath === oldPath) continue
    await client.renameFile(oldPath, newPath)
    count += 1
  }
  return count
}

/**
 * V2.5 rename pass：在三方合并前把远端旧前缀文件移到新前缀，并迁移远端/祖先 manifest。
 * 失败则整体放弃（不改写传入的 manifest），由调用方回落 V2.4 朴素路径。
 */
export async function executeVaultRenamePass(options: {
  localVaults: Record<string, string>
  lastRemoteVaults: Record<string, string>
  remoteManifest: SyncManifest
  ancestorSnapshot: SyncManifest
  cloudClient?: VaultRenameCloudClient | null
  /** WebDAV 等支持目录 MOVE 时为 true；S3 应为 false */
  preferDirectoryMove?: boolean
}): Promise<VaultRenamePassResult> {
  const renames = detectVaultRenameCandidates(
    options.localVaults,
    options.lastRemoteVaults,
    options.remoteManifest
  )
  if (renames.length === 0) {
    return { ok: false, reason: 'no_candidates', renames }
  }

  if (!supportsRenameFile(options.cloudClient)) {
    return { ok: false, reason: 'rename_unavailable', renames }
  }

  const client = options.cloudClient!
  const preferDirectoryMove = options.preferDirectoryMove === true
  let renamedFileCount = 0

  try {
    for (const candidate of renames) {
      renamedFileCount += await renameVaultRemoteFiles(client, candidate, preferDirectoryMove)
    }
  } catch (error) {
    return { ok: false, reason: 'rename_failed', error, renames }
  }

  const migrated = applyVaultRenamePassManifests(
    options.remoteManifest,
    options.ancestorSnapshot,
    renames
  )

  return {
    ok: true,
    remoteManifest: migrated.remoteManifest,
    ancestorSnapshot: migrated.ancestorSnapshot,
    renamedFileCount,
    renames
  }
}
