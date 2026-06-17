import type { ImportResult } from '@baishou/core-mobile'

export const ARCHIVE_SKIP_TOP_LEVEL = new Set([
  'database',
  'config',
  'manifest.json',
  'user-data'
])

function normalizeArchivePreservePath(uriOrPath: string): string {
  let p = uriOrPath.replace(/^file:\/\//, '').replace(/\/+$/, '')
  if (p.startsWith('/storage/storage/emulated/0')) {
    p = p.replace('/storage/storage/emulated/0', '/storage/emulated/0')
  } else if (p.startsWith('storage/storage/emulated/0')) {
    p = p.replace('storage/storage/emulated/0', '/storage/emulated/0')
  } else if (p.startsWith('/emulated/0')) {
    p = `/storage${p}`
  } else if (p.startsWith('emulated/0')) {
    p = `/storage/${p}`
  } else if (p.startsWith('storage/emulated/0')) {
    p = `/${p}`
  }
  return p
}

/**
 * 从快照文件名解析创建时间（优先于文件 mtime）。
 * 支持 Flutter：`snapshot_yyyyMMdd_HHmmss.zip`
 * 与移动端：`snapshot_yyyyMMdd_HHmmssSSS.zip`
 */
export function parseSnapshotCreatedAtFromFilename(filename: string): number | null {
  const match = /^snapshot_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(\d{0,3})\.zip$/i.exec(
    filename
  )
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const millis = Number((match[7] || '0').padEnd(3, '0').slice(0, 3))

  const parsed = new Date(year, month - 1, day, hour, minute, second, millis)
  const timestamp = parsed.getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function resolveSnapshotCreatedAt(filename: string, mtimeMs?: number): number {
  return parseSnapshotCreatedAtFromFilename(filename) ?? mtimeMs ?? Date.now()
}

export function assertSafeSnapshotFilename(filename: string): void {
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    filename.includes('%2e') ||
    !filename.startsWith('snapshot_') ||
    !filename.endsWith('.zip')
  ) {
    throw new Error('无效的快照文件名')
  }
}

export function isArchiveImportSuccessful(result: ImportResult): boolean {
  return result.fileCount > 0 || result.fileCount === -1
}

/** 归档恢复成功后刷新工作区 UI（含数据库热重载场景） */
export function shouldRefreshVaultAfterArchiveImport(result: ImportResult): boolean {
  return isArchiveImportSuccessful(result)
}

export function isValidArchiveManifestContent(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { formatVersion?: unknown }
    return typeof parsed.formatVersion === 'number' && parsed.formatVersion >= 1
  } catch {
    return false
  }
}

export function validateArchiveExtractPayload(options: {
  isFlutterLegacyZip: boolean
  isEmpty: boolean
  hasValidManifest: boolean
  hasDatabase: boolean
  hasVaultRegistry: boolean
  hasVaultDirectory: boolean
}): void {
  if (options.isFlutterLegacyZip) return
  if (options.isEmpty) {
    throw new Error('备份包为空，无法导入')
  }
  if (!options.hasValidManifest) {
    throw new Error('不是有效的 BaiShou 备份包：缺少或无效的 manifest.json')
  }
  if (!options.hasDatabase && !options.hasVaultRegistry && !options.hasVaultDirectory) {
    throw new Error('备份包格式无效：缺少数据库或工作区数据')
  }
}

/** @deprecated 仅保留给旧测试对照；请使用 hasVaultDirectory 等细粒度字段 */
export function hasArchiveWorkspaceEntries(entries: string[]): boolean {
  return entries
    .filter((name) => name && name !== '.' && name !== '..')
    .some((name) => !ARCHIVE_SKIP_TOP_LEVEL.has(name))
}

export function collectSnapshotPreserveKeys(preservePaths: string[]): {
  absolutes: Set<string>
  filenames: Set<string>
} {
  const absolutes = new Set<string>()
  const filenames = new Set<string>()

  for (const raw of preservePaths) {
    const normalized = normalizeArchivePreservePath(raw)
    absolutes.add(normalized)
    const base = normalized.split('/').filter(Boolean).pop()
    if (base?.startsWith('snapshot_') && base.endsWith('.zip')) {
      filenames.add(base)
    }
  }

  return { absolutes, filenames }
}

export function formatArchiveImportFailureMessage(
  error: unknown,
  snapshotPath?: string
): string {
  const base = error instanceof Error ? error.message : String(error)
  if (!snapshotPath) return base
  return `${base}\n已创建保护快照，可在「本地快照」中回退。`
}

export function formatArchiveExportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim() || '未知错误'
}
