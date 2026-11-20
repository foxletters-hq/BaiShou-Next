import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { journalMarkdownExistsInTree } from '../journal/journal-files.util'
import { deriveLegacyVaultId } from '../vault/vault-id.util'
import { sanitizeVaultDirectoryName } from '../vault/vault-name.util'
import type { VaultInfo } from '../vault/vault.types'
import {
  LEGACY_ARCHIVE_SKIP_TOP_LEVEL,
  LEGACY_MIGRATION_STATUS_FILE,
  LEGACY_REGISTRY_RELATIVE,
  MIN_AGENT_SQLITE_BYTES_FOR_IMPORT,
  NEXT_REGISTRY_FILENAME
} from './legacy-migration.constants'
import { countMigrationTreeFiles } from './legacy-migration.merge'

export async function readLegacyVaultRegistry(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<Array<{ name: string; createdAt?: string; lastAccessedAt?: string }>> {
  const registryPath = path.join(sourceDir, ...LEGACY_REGISTRY_RELATIVE.split('/'))
  try {
    const raw = await fileSystem.readFile(registryPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => typeof item?.name === 'string')
      .map((item) => ({
        name: item.name as string,
        createdAt: item.createdAt,
        lastAccessedAt: item.lastAccessedAt
      }))
  } catch {
    return []
  }
}

async function hasAnyNonHiddenFileInTree(
  fileSystem: IFileSystem,
  dirPath: string
): Promise<boolean> {
  if (!(await fileSystem.exists(dirPath))) return false
  const entries = await fileSystem.readdir(dirPath).catch(() => [])
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = path.join(dirPath, path.basename(entry))
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isFile) return true
      if (stat.isDirectory && (await hasAnyNonHiddenFileInTree(fileSystem, fullPath))) {
        return true
      }
    } catch {
      // 忽略不可读条目
    }
  }
  return false
}

async function hasAnyNonHiddenJsonFile(fileSystem: IFileSystem, dirPath: string): Promise<boolean> {
  if (!(await fileSystem.exists(dirPath))) return false
  const entries = await fileSystem.readdir(dirPath).catch(() => [])
  return entries.some((entry) => !entry.startsWith('.') && entry.endsWith('.json'))
}

function isUntouchedDefaultLatteJson(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return false
    const id = String(parsed.id ?? '').trim()
    if (id !== 'latte' && id !== 'default') return false
    const name = String(parsed.name ?? '').trim()
    if (name && name !== 'Latte' && name !== '拉提') return false
    if (typeof parsed.customSystemPrompt === 'string' && parsed.customSystemPrompt.trim()) {
      return false
    }
    if (typeof parsed.avatarPath === 'string' && parsed.avatarPath.trim()) {
      return false
    }
    if (typeof parsed.providerId === 'string' && parsed.providerId.trim()) {
      return false
    }
    if (typeof parsed.modelId === 'string' && parsed.modelId.trim()) {
      return false
    }
    return true
  } catch {
    return false
  }
}

async function hasCustomOrModifiedAssistant(
  fileSystem: IFileSystem,
  assistantsDir: string
): Promise<boolean> {
  if (!(await fileSystem.exists(assistantsDir))) return false
  const entries = await fileSystem.readdir(assistantsDir).catch(() => [])
  for (const entry of entries) {
    if (entry.startsWith('.') || !entry.endsWith('.json')) continue
    const safeName = path.basename(entry)
    if (safeName.toLowerCase() !== 'latte.json') {
      return true
    }
    try {
      const raw = await fileSystem.readFile(path.join(assistantsDir, safeName), 'utf8')
      if (!isUntouchedDefaultLatteJson(raw)) {
        return true
      }
    } catch {
      return true
    }
  }
  return false
}

/**
 * 工作区是否已有真实用户数据：
 * - Journals 下有 .md 日记
 * - Archives / Summaries / Attachments 下有实际文件
 * - Sessions 下有 .json 会话
 * - Assistants 下有自定义伙伴或已被用户修改过的 latte.json
 * - 旧版 .baishou/agent.sqlite 非空
 * 仅空文件夹、config/ 或全新安装生成的未修改默认 latte.json 视为无用户内容。
 */
export async function vaultDirectoryHasUserContent(
  fileSystem: IFileSystem,
  rootDir: string,
  vaultName: string
): Promise<boolean> {
  const vaultDir = path.join(rootDir, vaultName)
  if (!(await fileSystem.exists(vaultDir))) return false

  if (await journalMarkdownExistsInTree(fileSystem, path.join(vaultDir, 'Journals'))) {
    return true
  }

  for (const folder of ['Archives', 'Summaries', 'Attachments'] as const) {
    const dir = path.join(vaultDir, folder)
    if (await hasAnyNonHiddenFileInTree(fileSystem, dir)) {
      return true
    }
  }

  if (await hasAnyNonHiddenJsonFile(fileSystem, path.join(vaultDir, 'Sessions'))) {
    return true
  }

  if (await hasCustomOrModifiedAssistant(fileSystem, path.join(vaultDir, 'Assistants'))) {
    return true
  }

  const legacyAgentDb = path.join(vaultDir, '.baishou', 'agent.sqlite')
  if (await fileSystem.exists(legacyAgentDb)) {
    try {
      const stat = await fileSystem.stat(legacyAgentDb)
      if ((stat.size ?? 0) >= MIN_AGENT_SQLITE_BYTES_FOR_IMPORT) {
        return true
      }
    } catch {
      return true
    }
  }

  return false
}

/** 归档导入时是否值得迁移该工作区（跳过 registry 残留的空壳目录） */
export async function vaultHasImportableLegacyArchiveContent(
  fileSystem: IFileSystem,
  sourceDir: string,
  vaultName: string
): Promise<boolean> {
  const vaultDir = path.join(sourceDir, vaultName)
  if (await journalMarkdownExistsInTree(fileSystem, path.join(vaultDir, 'Journals'))) {
    return true
  }

  const archivesDir = path.join(vaultDir, 'Archives')
  if (await fileSystem.exists(archivesDir)) {
    if ((await countMigrationTreeFiles(fileSystem, archivesDir)) > 0) {
      return true
    }
  }

  const baishouPath = path.join(vaultDir, '.baishou', 'baishou.sqlite')
  if (await fileSystem.exists(baishouPath)) {
    return true
  }

  const agentPath = path.join(vaultDir, '.baishou', 'agent.sqlite')
  if (await fileSystem.exists(agentPath)) {
    try {
      const stat = await fileSystem.stat(agentPath)
      if ((stat.size ?? 0) >= MIN_AGENT_SQLITE_BYTES_FOR_IMPORT) {
        return true
      }
    } catch {
      // ignore
    }
  }

  return false
}

export async function discoverVaultNames(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<string[]> {
  const fromRegistry = await readLegacyVaultRegistry(fileSystem, sourceDir)
  if (fromRegistry.length > 0) {
    return fromRegistry.map((v) => v.name)
  }

  const discovered: string[] = []
  try {
    const entries = await fileSystem.readdir(sourceDir)
    for (const name of entries) {
      if (name.startsWith('.') || name === LEGACY_MIGRATION_STATUS_FILE) continue
      const vaultDir = path.join(sourceDir, name)
      try {
        const stat = await fileSystem.stat(vaultDir)
        if (!stat.isDirectory) continue
      } catch {
        continue
      }
      const hasContent =
        (await fileSystem.exists(path.join(vaultDir, 'Journals'))) ||
        (await fileSystem.exists(path.join(vaultDir, 'Archives'))) ||
        (await fileSystem.exists(path.join(vaultDir, '.baishou', 'agent.sqlite')))
      if (hasContent) discovered.push(name)
    }
  } catch {
    // ignore
  }

  return discovered.length > 0 ? discovered : ['Personal']
}

/**
 * 解析 Flutter 归档导入时应迁移的工作区列表。
 * 优先使用 legacy registry，但仅保留源目录中真实存在的 vault 文件夹。
 */
export async function resolveLegacyImportVaultNames(
  fileSystem: IFileSystem,
  sourceDir: string
): Promise<string[]> {
  const candidateNames = await discoverVaultNames(fileSystem, sourceDir)
  const present: string[] = []

  for (const name of candidateNames) {
    if (!name || LEGACY_ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
    const vaultDir = path.join(sourceDir, name)
    try {
      const stat = await fileSystem.stat(vaultDir)
      if (!stat.isDirectory) continue
    } catch {
      continue
    }
    if (!(await vaultHasImportableLegacyArchiveContent(fileSystem, sourceDir, name))) {
      continue
    }
    present.push(name)
  }

  return present.length > 0 ? present : ['Personal']
}

export async function writeNextVaultRegistry(
  fileSystem: IFileSystem,
  targetRoot: string,
  vaultNames: string[],
  legacyRegistry: Array<{ name: string; createdAt?: string; lastAccessedAt?: string }> = []
): Promise<VaultInfo[]> {
  const now = new Date()
  const vaults: VaultInfo[] = vaultNames.map((name) => {
    const legacy = legacyRegistry.find((item) => item.name === name)
    return {
      id: deriveLegacyVaultId(name),
      name,
      path: path.join(targetRoot, sanitizeVaultDirectoryName(name)),
      createdAt: legacy?.createdAt ? new Date(legacy.createdAt) : now,
      lastAccessedAt: legacy?.lastAccessedAt ? new Date(legacy.lastAccessedAt) : now
    }
  })

  const registryFile = path.join(targetRoot, NEXT_REGISTRY_FILENAME)
  const serializable = vaults.map((vault) => ({
    id: vault.id,
    name: vault.name,
    path: vault.path,
    createdAt: vault.createdAt.toISOString(),
    lastAccessedAt: vault.lastAccessedAt.toISOString()
  }))
  await fileSystem.mkdir(targetRoot, { recursive: true })
  await fileSystem.writeFile(registryFile, JSON.stringify(serializable, null, 2), 'utf8')
  return vaults
}
