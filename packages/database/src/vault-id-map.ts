/**
 * 仓库身份 V2.2：name→id 映射加载与解析。
 *
 * MigrationService 无 VaultService：优先读 vault_registry.json / vault.json，
 * 否则对精确名字走 deriveLegacyVaultId（与 V2.1 同函数）。
 */

import * as fs from 'fs'
import * as path from 'path'
import { deriveLegacyVaultId, isVaultId, logger } from '@baishou/shared'

export type VaultNameToIdMap = Map<string, string>

type RegistryEntry = {
  name?: unknown
  id?: unknown
  path?: unknown
}

function readJsonFile(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function readVaultJsonId(vaultDir: string): string | null {
  const meta = readJsonFile(path.join(vaultDir, '.baishou', 'vault.json'))
  if (!meta || typeof meta !== 'object') return null
  const id = (meta as { id?: unknown }).id
  return typeof id === 'string' && isVaultId(id) ? id : null
}

/**
 * 从存储根加载 name→id。注册表 / vault.json 优先；缺失则跳过（调用方用 derive 补）。
 */
export function loadVaultNameToIdMapFromStorageRoot(storageRoot: string): VaultNameToIdMap {
  const map: VaultNameToIdMap = new Map()
  if (!storageRoot?.trim()) return map

  const registryPath = path.join(storageRoot, 'vault_registry.json')
  const raw = readJsonFile(registryPath)
  const entries: RegistryEntry[] = Array.isArray(raw) ? (raw as RegistryEntry[]) : []

  for (const entry of entries) {
    const name = typeof entry.name === 'string' ? entry.name : ''
    if (!name) continue

    let id: string | null = typeof entry.id === 'string' && isVaultId(entry.id) ? entry.id : null
    if (!id) {
      const vaultDir =
        typeof entry.path === 'string' && entry.path.trim()
          ? entry.path
          : path.join(storageRoot, name)
      id = readVaultJsonId(vaultDir)
    }
    if (id) map.set(name, id)
  }

  // 扫盘：注册表遗漏但磁盘上有 vault.json 的目录
  try {
    const names = fs.readdirSync(storageRoot, { withFileTypes: true })
    for (const ent of names) {
      if (!ent.isDirectory()) continue
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue
      if (map.has(ent.name)) continue
      const id = readVaultJsonId(path.join(storageRoot, ent.name))
      if (id) map.set(ent.name, id)
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[VaultIdMap] 扫盘补齐 vault.json 失败（非阻塞）:', message)
  }

  return map
}

/** 解析仓库 ID：映射优先，否则确定性派生 */
export function resolveVaultIdFromName(name: string, map?: VaultNameToIdMap | null): string {
  const exact = name // 不做 trim/case-fold，与 deriveLegacyVaultId / V2.1 一致
  if (map?.has(exact)) return map.get(exact)!
  if (isVaultId(exact)) return exact
  return deriveLegacyVaultId(exact)
}

/**
 * 为 DISTINCT 旧名补齐映射（已有 id 不动；缺失用 derive）。
 */
export function ensureVaultIdsForNames(
  names: Iterable<string>,
  map?: VaultNameToIdMap | null
): VaultNameToIdMap {
  const out: VaultNameToIdMap = new Map(map ?? [])
  for (const name of names) {
    if (!name || out.has(name)) continue
    out.set(name, resolveVaultIdFromName(name, out))
  }
  return out
}
