import { normalizeStoragePath } from './android-external-fs'
import { joinStoragePath } from './mobile-storage-path.util'
import {
  assertSafeSnapshotFilename,
  collectSnapshotPreserveKeys,
  resolveSnapshotCreatedAt,
  SNAPSHOT_STORAGE_DIR_NAMES
} from './archive-guards.util'
import type { ArchiveImportContext } from './archive-import.helpers'

export async function wipeStorageRootPreservingSnapshots(
  ctx: ArchiveImportContext,
  rootDir: string
): Promise<void> {
  const entries = await ctx.fileSystem.readdir(rootDir).catch(() => [] as string[])
  for (const itemName of entries) {
    if (!itemName || itemName === '.' || itemName === '..') continue
    if (SNAPSHOT_STORAGE_DIR_NAMES.has(itemName)) continue
    await ctx.fileSystem
      .rm(joinStoragePath(rootDir, itemName), { recursive: true, force: true })
      .catch((e) => {
        console.warn('[MobileArchive] Failed to wipe storage entry', itemName, e)
      })
  }
}

export async function selectiveCopyArchiveTree(
  ctx: ArchiveImportContext,
  sourceDirPath: string,
  targetDirPath: string
): Promise<void> {
  const dirContent = await ctx.fileSystem.readdir(sourceDirPath)

  for (const itemName of dirContent) {
    if (!itemName || itemName === '.' || itemName === '..') continue
    if (SNAPSHOT_STORAGE_DIR_NAMES.has(itemName)) continue
    if (itemName.endsWith('-wal') || itemName.endsWith('-shm') || itemName.endsWith('-journal'))
      continue

    const fullSourcePath = joinStoragePath(sourceDirPath, itemName)
    const fullTargetPath = joinStoragePath(targetDirPath, itemName)

    const stat = await ctx.fileSystem.stat(fullSourcePath)
    if (stat.isDirectory) {
      await ctx.fileSystem.mkdir(fullTargetPath, { recursive: true })
      await selectiveCopyArchiveTree(ctx, fullSourcePath, fullTargetPath)
    } else {
      await ctx.fileSystem.copyFile(fullSourcePath, fullTargetPath)
    }
  }
}

export async function getArchiveSnapshotDir(
  ctx: Pick<ArchiveImportContext, 'pathService'>
): Promise<string> {
  return ctx.pathService.getSnapshotsDirectory()
}

export async function finalizeArchiveSnapshotFromExport(
  ctx: ArchiveImportContext,
  zipPath: string,
  maxCount: number,
  preservePaths: string[] = []
): Promise<string | null> {
  const snapshotDir = await getArchiveSnapshotDir(ctx)
  await ctx.fileSystem.mkdir(snapshotDir, { recursive: true })

  const dt = new Date()
  const ts = [
    dt.getFullYear(),
    (dt.getMonth() + 1).toString().padStart(2, '0'),
    dt.getDate().toString().padStart(2, '0'),
    '_',
    dt.getHours().toString().padStart(2, '0'),
    dt.getMinutes().toString().padStart(2, '0'),
    dt.getSeconds().toString().padStart(2, '0'),
    dt.getMilliseconds().toString().padStart(3, '0')
  ].join('')
  const finalSnapPath = joinStoragePath(snapshotDir, `snapshot_${ts}.zip`)

  try {
    await ctx.fileSystem.rename(zipPath, finalSnapPath)
  } catch {
    await ctx.fileSystem.copyFile(zipPath, finalSnapPath)
    await ctx.fileSystem.unlink(zipPath).catch(() => {})
  }

  const preserve = [
    normalizeStoragePath(finalSnapPath),
    ...preservePaths.map((p) => normalizeStoragePath(p))
  ]
  await pruneArchiveSnapshots(ctx, maxCount, preserve)
  return finalSnapPath
}

export async function listArchiveSnapshots(
  ctx: ArchiveImportContext
): Promise<import('@baishou/core-mobile').SnapshotMeta[]> {
  const snapshotDir = await getArchiveSnapshotDir(ctx)
  if (!(await ctx.fileSystem.exists(snapshotDir))) return []

  const files = await ctx.fileSystem.readdir(snapshotDir)
  const results: import('@baishou/core-mobile').SnapshotMeta[] = []
  for (const filename of files) {
    if (!filename.endsWith('.zip') || !filename.startsWith('snapshot_')) continue
    const fullPath = `${snapshotDir}/${filename}`
    try {
      const stat = await ctx.fileSystem.stat(fullPath)
      if (!stat.isFile) continue
      results.push({
        filename,
        createdAt: resolveSnapshotCreatedAt(filename, stat.mtimeMs),
        size: stat.size ?? 0
      })
    } catch {
      // skip
    }
  }
  return results.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteArchiveSnapshot(
  ctx: ArchiveImportContext,
  filename: string
): Promise<void> {
  assertSafeSnapshotFilename(filename)
  const snapshotDir = await getArchiveSnapshotDir(ctx)
  const fullPath = joinStoragePath(snapshotDir, filename)
  await ctx.fileSystem.unlink(fullPath)
}

export async function pruneArchiveSnapshots(
  ctx: ArchiveImportContext,
  maxCount: number,
  preservePaths: string[] = []
): Promise<void> {
  if (maxCount < 0) return

  const preserve = collectSnapshotPreserveKeys(preservePaths)
  const snapshotDir = normalizeStoragePath(await getArchiveSnapshotDir(ctx))
  let list = await listArchiveSnapshots(ctx)

  while (list.length > maxCount) {
    const oldestFirst = [...list].reverse()
    let deleted = false

    for (const item of oldestFirst) {
      const fullPath = normalizeStoragePath(`${snapshotDir}/${item.filename}`)
      if (preserve.absolutes.has(fullPath) || preserve.filenames.has(item.filename)) continue
      await deleteArchiveSnapshot(ctx, item.filename).catch(() => {})
      deleted = true
      break
    }

    if (!deleted) break
    list = await listArchiveSnapshots(ctx)
  }
}
