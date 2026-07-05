import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'

export const VAULT_EXTERNAL_PATHS_FILE = 'external_paths.json'

/** 设备本地配置：各端外部日记/总结绝对路径，不参与增量同步跨设备传播 */
export interface VaultExternalPathsConfig {
  /** 工作区外的自定义日记 Markdown 根目录（绝对路径） */
  journalsDirectory?: string | null
  /** 工作区外的自定义总结 Markdown 根目录（绝对路径，对应 Archives） */
  summariesDirectory?: string | null
}

export type VaultExternalPathsPatch = {
  journalsDirectory?: string | null
  summariesDirectory?: string | null
}

export function resolveJournalsBaseDirectory(
  vaultDirectory: string,
  external: VaultExternalPathsConfig
): string {
  const custom = external.journalsDirectory?.trim()
  if (custom) return custom
  return path.join(vaultDirectory, 'Journals')
}

export function resolveSummariesBaseDirectory(
  vaultDirectory: string,
  external: VaultExternalPathsConfig
): string {
  const custom = external.summariesDirectory?.trim()
  if (custom) return custom
  return path.join(vaultDirectory, 'Archives')
}

function normalizeStoredPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export async function readVaultExternalPaths(
  fileSystem: IFileSystem,
  vaultSystemDirectory: string
): Promise<VaultExternalPathsConfig> {
  const filePath = path.join(vaultSystemDirectory, VAULT_EXTERNAL_PATHS_FILE)
  try {
    const raw = await fileSystem.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as VaultExternalPathsConfig
    const journalsDirectory = normalizeStoredPath(parsed.journalsDirectory)
    const summariesDirectory = normalizeStoredPath(parsed.summariesDirectory)
    return {
      ...(journalsDirectory ? { journalsDirectory } : {}),
      ...(summariesDirectory ? { summariesDirectory } : {})
    }
  } catch {
    return {}
  }
}

export async function patchVaultExternalPaths(
  fileSystem: IFileSystem,
  vaultSystemDirectory: string,
  patch: VaultExternalPathsPatch
): Promise<void> {
  const existing = await readVaultExternalPaths(fileSystem, vaultSystemDirectory)
  const next: VaultExternalPathsConfig = { ...existing }

  if ('journalsDirectory' in patch) {
    const value = patch.journalsDirectory?.trim()
    if (value) next.journalsDirectory = value
    else delete next.journalsDirectory
  }
  if ('summariesDirectory' in patch) {
    const value = patch.summariesDirectory?.trim()
    if (value) next.summariesDirectory = value
    else delete next.summariesDirectory
  }

  await fileSystem.mkdir(vaultSystemDirectory, { recursive: true })
  const filePath = path.join(vaultSystemDirectory, VAULT_EXTERNAL_PATHS_FILE)
  await fileSystem.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

/** @deprecated 使用 patchVaultExternalPaths */
export async function writeVaultExternalPaths(
  fileSystem: IFileSystem,
  vaultSystemDirectory: string,
  config: VaultExternalPathsConfig
): Promise<void> {
  await patchVaultExternalPaths(fileSystem, vaultSystemDirectory, config)
}
